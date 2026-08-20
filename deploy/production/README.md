# Production deployment

This application is deployed on an Ubuntu 26.04 LTS host with Nginx, PHP 8.5
FPM, PostgreSQL, Supervisor, and Certbot. Provision the VPS and DNS record
before starting. The release directory below is `/var/www/photobooth`; replace
the placeholders in every supplied example before installing it.

## Provision the host

Install Nginx, PHP 8.5 FPM with the PostgreSQL, GD, XML, curl, mbstring, zip,
and bcmath extensions, PostgreSQL client tools, Supervisor, and Certbot's
Nginx plugin. Create a non-login `photobooth` system user and make it the
owner of the release directory, `storage`, and `bootstrap/cache`. PHP-FPM and
the queue worker must run as this user.

Create a PostgreSQL role and database with an owner that is distinct from the
backup role. Give the backup role only the rights required by `pg_dump`.

## Release configuration

1. Deploy the application to `/var/www/photobooth` without `.env` files.
2. Copy `photobooth.env.example` to `/var/www/photobooth/.env`, set all
   placeholders through the host's secret manager, then set mode `640` and
   ownership to the PHP-FPM user. Do not use SQLite or `local` defaults:
   `DB_CONNECTION=pgsql`, `FILESYSTEM_DISK=public`, and
   `QUEUE_CONNECTION=database` are required.
3. Install dependencies and frontend assets, then run:

   ```bash
   composer install --no-dev --prefer-dist --optimize-autoloader
   npm ci
   npm run build
   php artisan migrate --force
   php artisan storage:link
   php artisan optimize
   ```

The gallery, capture processing, admin-uploaded templates/stickers, and
rendered receipts all explicitly use the named `public` disk. Its root,
`storage/app/public`, must therefore be persistent across releases and exposed
only through the `public/storage` symlink created above. Do not switch this
application to S3 until those calls are changed together.

## HTTPS, scheduler, and queue worker

1. Replace `__DOMAIN__` and `__APP_ROOT__` in `nginx.conf.example`, install it
   under `/etc/nginx/sites-available/photobooth`, enable the site, and verify
   with `nginx -t` before reloading Nginx.
2. Issue the certificate after DNS resolves:

   ```bash
   sudo certbot --nginx -d photobooth.example.com --redirect
   ```

   Confirm Certbot's renewal timer is enabled.
3. Install `photobooth-schedule.cron.example` for the application user. It
   drives `photobooth:expire-sessions` every minute and `media:prune-expired`
   hourly through Laravel's scheduler.
4. Replace placeholders in `supervisor-worker.conf.example`, install it under
   `/etc/supervisor/conf.d/`, then run `supervisorctl reread`,
   `supervisorctl update`, and `supervisorctl status`. The worker is required
   because completed sessions dispatch `ProcessPrintJob` asynchronously.

Restart the queue worker after each deployment with
`php artisan queue:restart`; Supervisor will start a fresh worker.

## Backups and recovery

Install `backup.sh` as `/usr/local/sbin/photobooth-backup`, owned by root and
mode `750`. Copy `backup.env.example` to `/etc/photobooth/backup.env` and set
mode `600`. Create `/etc/photobooth/.pgpass` with mode `600`, owned by the
backup user, containing one line in PostgreSQL's standard form:

```text
host:port:database:username:password
```

Schedule the script with a root cron job, for example at 02:15 UTC:

```cron
15 2 * * * /usr/local/sbin/photobooth-backup
```

It creates a PostgreSQL custom-format dump and a compressed archive of the
public media disk, then retains the configured number of daily backup
directories. Replicate `BACKUP_DESTINATION` to off-host, encrypted storage and
test restoration at least quarterly. Restore to an isolated database with
`pg_restore` and restore media into `storage/app/public` before recreating the
storage link; never test a restore against production.

## Read-only post-deploy checks

Run these after the production environment is configured. They do not mutate
the database:

```bash
php artisan about
php artisan config:show database.default
php artisan config:show filesystems.default
php artisan config:show queue.default
php artisan schedule:list
php artisan route:list --except-vendor
```

The configuration checks must report `pgsql`, `public`, and `database`.
