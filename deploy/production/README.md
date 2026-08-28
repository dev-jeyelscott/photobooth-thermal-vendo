# ThermaSnap production deployment

ThermaSnap runs as a non-Sail Docker Compose application on an Ubuntu 26.04
LTS host.

The production application topology is:

- host Nginx and Certbot for HTTPS termination
- container Nginx
- PHP 8.5 FPM application container
- PostgreSQL container
- database queue worker container
- Laravel scheduler container
- persistent host-mounted public media

The host does not require PHP, Composer, Node.js, Supervisor, Laravel Cron, or
a PostgreSQL server.

## Host prerequisites

Install:

- Docker Engine
- Docker Compose plugin
- Nginx
- Certbot and the Certbot Nginx plugin
- PostgreSQL client tools for `pg_dump`
- Git

Deploy the repository to `/var/www/photobooth`.

Create the persistent directories:

```bash
sudo mkdir -p \
    /etc/photobooth \
    /srv/photobooth/media \
    /var/backups/photobooth

sudo chown -R 10001:10001 /srv/photobooth/media
sudo chmod 0755 /srv/photobooth/media
```

The default production PHP image uses UID/GID `10001`. If `APP_UID` or
`APP_GID` are changed while building the image, give the persistent media
directory matching ownership.

## Application environment

Create the runtime files outside the repository:

```bash
sudo cp deploy/production/photobooth.env.example /etc/photobooth/app.env
sudo cp deploy/production/postgres.env.example /etc/photobooth/postgres.env
sudo cp deploy/production/backup.env.example /etc/photobooth/backup.env

sudo chmod 600 \
    /etc/photobooth/app.env \
    /etc/photobooth/postgres.env \
    /etc/photobooth/backup.env
```

Populate all placeholders through the host secret-management process.

`DB_PASSWORD` in `app.env` must equal `APP_DB_PASSWORD` in `postgres.env`.

`photobooth.env.example` is the production environment reference. It sets the
application to `APP_ENV=production`, uses an HTTPS `APP_URL`, and configures
the existing `pgsql` connection with `DB_HOST`, `DB_PORT`, `DB_DATABASE`,
`DB_USERNAME`, `DB_PASSWORD`, and `DB_SSLMODE`. Its `DB_SSLMODE=prefer` value
is appropriate for the private Docker network; use `require` when a managed
PostgreSQL provider requires TLS. It also selects the existing database queue,
database cache and sessions, `stderr` logging, and Laravel's durable `public`
filesystem disk.

The `MAYA_BASE_URL`, `MAYA_PUBLIC_KEY`, `MAYA_SECRET_KEY`, and
`MAYA_WEBHOOK_SECRET` values are environment-managed only. Never store or
expose them through an admin-editable application setting.

Generate an application key without writing it into an image:

```bash
docker compose \
    -f compose.production.yaml \
    run --rm --no-deps app \
    php artisan key:generate --show --no-ansi
```

Place the returned key into `/etc/photobooth/app.env`.

Do not commit production environment files.

## First deployment

Build the immutable application and Nginx images:

```bash
docker compose -f compose.production.yaml build --pull app nginx
```

Start PostgreSQL first:

```bash
docker compose -f compose.production.yaml up -d postgres
docker compose -f compose.production.yaml ps
```

Run database migrations explicitly:

```bash
docker compose \
    -f compose.production.yaml \
    run --rm --no-deps app \
    php artisan migrate --force
```

Migrations are intentionally not part of the application entrypoint.

Start the remaining services:

```bash
docker compose \
    -f compose.production.yaml \
    up -d app worker scheduler nginx
```

Check the stack:

```bash
docker compose -f compose.production.yaml ps
curl --fail http://127.0.0.1:8081/up
```

## HTTPS

Replace `__DOMAIN__` in `deploy/production/nginx.conf.example`, install the
file under `/etc/nginx/sites-available/photobooth`, enable it, then validate:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

After DNS resolves:

```bash
sudo certbot --nginx -d photobooth.example.com --redirect
```

Confirm Certbot renewal is enabled.

HTTPS is required in production for browser camera APIs and for secure public
payment/webhook operation.

## Queue worker

The `worker` service runs the existing database-backed default queue with:

```text
--sleep=3
--tries=3
--timeout=60
--max-time=3600
```

The worker is restarted by Docker rather than Supervisor.

Inspect it with:

```bash
docker compose -f compose.production.yaml logs -f worker
docker compose -f compose.production.yaml exec app php artisan queue:failed
```

## Laravel scheduler

The `scheduler` service runs:

```bash
php artisan schedule:work
```

It owns the repository's current scheduled tasks:

- `photobooth:expire-sessions` every minute
- `media:prune-expired` hourly
- `payments:reconcile-stale-maya` every five minutes. It flags Maya payments
  pending for more than 15 minutes for operator review; it never marks a
  payment successful because only a verified Maya webhook is authoritative.

No host Laravel Cron entry is required.

Inspect it with:

```bash
docker compose -f compose.production.yaml logs -f scheduler
docker compose -f compose.production.yaml exec app php artisan schedule:list
```

## Persistent public media

The repository explicitly uses Laravel's named `public` disk for captured
media, templates, stickers, generated media, galleries, and rendered receipts.

Production mounts:

```text
/srv/photobooth/media
    ->
/var/www/html/storage/app/public
```

Do not delete this directory during deployment.

Do not move the application to S3 as part of Docker deployment unless all
explicit public-disk consumers are migrated together.

## Printer bridge

The application container does not mount USB printer hardware.

Keep `PHOTOBOOTH_DEFAULT_PRINTER_DRIVER=local_mock` where physical printing is
not configured.

For production bridge printing, configure:

```text
PHOTOBOOTH_DEFAULT_PRINTER_DRIVER=print_bridge
PHOTOBOOTH_PRINT_BRIDGE_ENDPOINT=http://...
PHOTOBOOTH_PRINT_BRIDGE_AUTH_TOKEN=...
```

A print bridge running directly on the Docker host can be addressed through
`host.docker.internal`.

## Normal deployment update

After pulling an approved release:

```bash
git pull --ff-only

docker compose -f compose.production.yaml build app nginx

docker compose \
    -f compose.production.yaml \
    run --rm --no-deps app \
    php artisan migrate --force

docker compose \
    -f compose.production.yaml \
    up -d app worker scheduler nginx
```

Recreating the worker container replaces the old Supervisor-era
`queue:restart` deployment step.

## Backups

The PostgreSQL container publishes port `5432` only on host loopback port
`54320`. This preserves the existing host-side `pg_dump` backup design without
exposing PostgreSQL publicly.

Create `/etc/photobooth/.pgpass` with mode `600`:

```text
127.0.0.1:54320:photobooth:photobooth_backup:<backup-password>
```

The password must match `BACKUP_DB_PASSWORD` in
`/etc/photobooth/postgres.env`.

Install the existing backup script:

```bash
sudo install \
    -o root \
    -g root \
    -m 750 \
    deploy/production/backup.sh \
    /usr/local/sbin/photobooth-backup
```

A root Cron entry may run backups independently of Laravel, for example:

```cron
15 2 * * * /usr/local/sbin/photobooth-backup
```

The backup contains:

- PostgreSQL custom-format database dump
- compressed `/srv/photobooth/media` archive

Replicate backups to encrypted off-host storage.

Test restoration at least quarterly against an isolated environment. Never
test restore procedures against production.

## Read-only post-deploy checks

```bash
docker compose -f compose.production.yaml exec app php artisan about

docker compose \
    -f compose.production.yaml \
    exec app \
    php artisan config:show database.default

docker compose \
    -f compose.production.yaml \
    exec app \
    php artisan config:show filesystems.default

docker compose \
    -f compose.production.yaml \
    exec app \
    php artisan config:show queue.default

docker compose \
    -f compose.production.yaml \
    exec app \
    php artisan schedule:list

docker compose \
    -f compose.production.yaml \
    exec app \
    php artisan route:list --except-vendor
```

Expected values:

```text
database.default    pgsql
filesystems.default public
queue.default       database
```

## Operational logs

```bash
docker compose -f compose.production.yaml logs -f app
docker compose -f compose.production.yaml logs -f nginx
docker compose -f compose.production.yaml logs -f worker
docker compose -f compose.production.yaml logs -f scheduler
docker compose -f compose.production.yaml logs -f postgres
```

Application logs use stderr in production so they remain visible through
Docker's normal logging interface.
