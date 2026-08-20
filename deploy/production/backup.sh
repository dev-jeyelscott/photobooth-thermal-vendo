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

if [[ ! -r "$PGPASSFILE" || ! -d "$MEDIA_SOURCE" ]]; then
    echo "The PostgreSQL password file or media source is not accessible." >&2
    exit 1
fi

if [[ "$BACKUP_DESTINATION" == "/" || "$BACKUP_DESTINATION" == "$MEDIA_SOURCE" ]]; then
    echo "Backup destination must be a dedicated directory, not the filesystem or media root." >&2
    exit 1
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_directory="$BACKUP_DESTINATION/$timestamp"
mkdir -p "$backup_directory"

export PGPASSFILE
pg_dump --format=custom --no-owner --no-privileges \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USERNAME" \
    --file="$backup_directory/database.dump" \
    "$DB_DATABASE"

tar --create --gzip --file="$backup_directory/media.tar.gz" --directory="$MEDIA_SOURCE" .

find "$BACKUP_DESTINATION" -mindepth 1 -maxdepth 1 -type d -mtime +"${RETENTION_DAYS:-14}" -exec rm -rf -- {} +
