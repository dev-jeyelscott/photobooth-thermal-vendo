#!/usr/bin/env bash

set -euo pipefail
umask 077

backup_config="${BACKUP_CONFIG:-/etc/photobooth/backup.env}"

if [[ ! -r "$backup_config" ]]; then
    echo "Backup configuration is not readable: $backup_config" >&2
    exit 1
fi

# shellcheck source=/etc/photobooth/backup.env
source "$backup_config"

for required_variable in BACKUP_DESTINATION MEDIA_SOURCE DB_HOST DB_PORT DB_DATABASE DB_USERNAME PGPASSFILE; do
    if [[ -z "${!required_variable:-}" ]]; then
        echo "Missing required backup setting: $required_variable" >&2
        exit 1
    fi
done

for required_command in pg_dump pg_restore tar sha256sum; do
    if ! command -v "$required_command" >/dev/null 2>&1; then
        echo "Required backup command is unavailable: $required_command" >&2
        exit 1
    fi
done

if [[ ! -r "$PGPASSFILE" || ! -d "$MEDIA_SOURCE" ]]; then
    echo "The PostgreSQL password file or media source is not accessible." >&2
    exit 1
fi

if [[ "$BACKUP_DESTINATION" == "/" || "$BACKUP_DESTINATION" == "$MEDIA_SOURCE" ]]; then
    echo "Backup destination must be a dedicated directory, not the filesystem or media root." >&2
    exit 1
fi

mkdir -p "$BACKUP_DESTINATION"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
partial_directory="$BACKUP_DESTINATION/.${timestamp}.partial"
backup_directory="$BACKUP_DESTINATION/$timestamp"
backup_completed=false

if [[ -e "$partial_directory" || -e "$backup_directory" ]]; then
    echo "Backup destination already exists for timestamp: $timestamp" >&2
    exit 1
fi

# Remove only the incomplete directory from this invocation when any backup
# or verification step fails. Previously completed backup sets are untouched.
cleanup_incomplete_backup() {
    if [[ "$backup_completed" != true && -d "$partial_directory" ]]; then
        rm -rf -- "$partial_directory"
    fi
}

trap cleanup_incomplete_backup EXIT

mkdir -p "$partial_directory"

export PGPASSFILE
pg_dump --format=custom --no-owner --no-privileges \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USERNAME" \
    --file="$partial_directory/database.dump" \
    "$DB_DATABASE"

tar --create --gzip --file="$partial_directory/media.tar.gz" --directory="$MEDIA_SOURCE" .

test -s "$partial_directory/database.dump"
test -s "$partial_directory/media.tar.gz"

pg_restore --list "$partial_directory/database.dump" >/dev/null
tar --list --gzip --file="$partial_directory/media.tar.gz" >/dev/null

(
    cd "$partial_directory"
    sha256sum database.dump media.tar.gz > SHA256SUMS
    sha256sum --check SHA256SUMS >/dev/null
)

printf 'verified_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$partial_directory/COMPLETE"

mv -- "$partial_directory" "$backup_directory"
backup_completed=true

find "$BACKUP_DESTINATION" \
    -mindepth 1 \
    -maxdepth 1 \
    -type d \
    -name '20??????T??????Z' \
    -mtime +"${RETENTION_DAYS:-14}" \
    -exec rm -rf -- {} +

printf 'Verified backup created: %s\n' "$backup_directory"
