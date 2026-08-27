#!/usr/bin/env bash

set -euo pipefail

project_name="thermasnap-smoke-${GITHUB_RUN_ID:-$$}"
app_port="${THERMASNAP_SMOKE_APP_PORT:-18080}"
vite_port="${THERMASNAP_SMOKE_VITE_PORT:-15173}"
postgres_port="${THERMASNAP_SMOKE_POSTGRES_PORT:-15432}"
media_probe="storage/app/public/docker-smoke.txt"
queue_probe="storage/app/public/docker-queue-smoke.txt"

env_backup=""
if [[ -f .env.docker ]]; then
    env_backup="$(mktemp)"
    cp .env.docker "$env_backup"
fi

# Restore the developer's original environment and remove all isolated Docker
# resources created by this smoke test.
cleanup() {
    docker compose \
        -p "$project_name" \
        down \
        --volumes \
        --remove-orphans >/dev/null 2>&1 || true

    rm -f "$media_probe" "$queue_probe"

    if [[ -n "$env_backup" && -f "$env_backup" ]]; then
        cp "$env_backup" .env.docker
        rm -f "$env_backup"
    else
        rm -f .env.docker
    fi
}

# Poll an HTTP endpoint until it succeeds or the bounded retry count is
# exhausted.
wait_for_http() {
    local url="$1"
    local attempts="${2:-30}"

    for ((attempt = 1; attempt <= attempts; attempt++)); do
        if curl --fail --silent --show-error "$url" >/dev/null 2>&1; then
            return 0
        fi

        sleep 2
    done

    echo "HTTP endpoint did not become ready: $url" >&2
    return 1
}

trap cleanup EXIT

cp .env.docker.example .env.docker

app_key="base64:$(openssl rand -base64 32 | tr -d '\n')"
sed -i "s|^APP_KEY=.*$|APP_KEY=${app_key}|" .env.docker

export APP_UID
export APP_GID
export APP_PORT="$app_port"
export VITE_PORT="$vite_port"
export POSTGRES_HOST_PORT="$postgres_port"

APP_UID="$(id -u)"
APP_GID="$(id -g)"

docker compose -p "$project_name" config --quiet

APP_ENV_FILE="$PWD/.env.docker" \
POSTGRES_ENV_FILE="$PWD/.env.docker" \
THERMASNAP_MEDIA_PATH="$PWD/storage/app/public" \
NGINX_HOST_PORT=18081 \
POSTGRES_HOST_PORT=15433 \
docker compose \
    -p "${project_name}-production-config" \
    -f compose.production.yaml \
    config --quiet

docker build --target app -t thermasnap-app:smoke .
docker build --target nginx -t thermasnap-nginx:smoke .

docker run \
    --rm \
    --entrypoint sh \
    thermasnap-app:smoke \
    -c '
        test -f public/build/manifest.json
        ! command -v node >/dev/null 2>&1
        ! command -v npm >/dev/null 2>&1
        ! command -v composer >/dev/null 2>&1
    '

docker run \
    --rm \
    --entrypoint php \
    thermasnap-app:smoke \
    -m > /tmp/thermasnap-php-modules.txt

for extension in \
    bcmath \
    curl \
    dom \
    gd \
    mbstring \
    pcntl \
    pdo_pgsql \
    pdo_sqlite \
    xml \
    zip
do
    grep -iFx "$extension" /tmp/thermasnap-php-modules.txt >/dev/null
done

rm -f /tmp/thermasnap-php-modules.txt

docker compose -p "$project_name" build app

docker compose -p "$project_name" up -d postgres

docker compose \
    -p "$project_name" \
    run --rm --no-deps app \
    php artisan migrate --force

docker compose \
    -p "$project_name" \
    up -d app worker scheduler vite nginx

wait_for_http "http://127.0.0.1:${app_port}/up"
wait_for_http "http://127.0.0.1:${vite_port}/@vite/client"

curl \
    --fail \
    --silent \
    --show-error \
    --dump-header /tmp/thermasnap-redirect-headers.txt \
    --output /dev/null \
    "http://127.0.0.1:${app_port}/admin"

grep -q "^Location: http://127.0.0.1:${app_port}/login" /tmp/thermasnap-redirect-headers.txt
rm -f /tmp/thermasnap-redirect-headers.txt

docker compose \
    -p "$project_name" \
    exec -T app \
    php artisan config:show database.default | grep -q pgsql

docker compose \
    -p "$project_name" \
    exec -T app \
    php artisan config:show filesystems.default | grep -q public

docker compose \
    -p "$project_name" \
    exec -T app \
    php artisan config:show queue.default | grep -q database

docker compose \
    -p "$project_name" \
    exec -T app \
    php artisan migrate:status >/dev/null

schedule_output="$(
    docker compose \
        -p "$project_name" \
        exec -T app \
        php artisan schedule:list
)"

grep -q 'photobooth:expire-sessions' <<<"$schedule_output"
grep -q 'media:prune-expired' <<<"$schedule_output"

docker compose \
    -p "$project_name" \
    exec -T worker \
    sh -c 'tr "\0" " " </proc/1/cmdline' | grep -q 'queue:work'

docker compose \
    -p "$project_name" \
    exec -T scheduler \
    sh -c 'tr "\0" " " </proc/1/cmdline' | grep -q 'schedule:work'

docker compose \
    -p "$project_name" \
    exec -T app \
    php artisan tinker --execute='dispatch(function (): void { file_put_contents(storage_path("app/public/docker-queue-smoke.txt"), "queue-ok"); });'

for _ in {1..30}; do
    if [[ -f "$queue_probe" ]]; then
        break
    fi

    sleep 1
done

test -f "$queue_probe"
grep -q 'queue-ok' "$queue_probe"

docker compose \
    -p "$project_name" \
    exec -T scheduler \
    php artisan schedule:run --verbose

docker compose \
    -p "$project_name" \
    exec -T app \
    php artisan media:prune-expired

printf 'persistent-media-ok\n' > "$media_probe"

curl \
    --fail \
    --silent \
    "http://127.0.0.1:${app_port}/storage/docker-smoke.txt" \
    | grep -q 'persistent-media-ok'

docker compose \
    -p "$project_name" \
    restart app worker scheduler nginx postgres

wait_for_http "http://127.0.0.1:${app_port}/up"

curl \
    --fail \
    --silent \
    "http://127.0.0.1:${app_port}/storage/docker-smoke.txt" \
    | grep -q 'persistent-media-ok'

docker compose \
    -p "$project_name" \
    exec -T app \
    php artisan migrate:status >/dev/null

echo "ThermaSnap Docker smoke verification passed."
