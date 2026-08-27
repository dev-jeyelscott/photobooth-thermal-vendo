#!/bin/bash

set -euo pipefail

for required_variable in \
    APP_DB_NAME \
    APP_DB_USER \
    APP_DB_PASSWORD \
    BACKUP_DB_USER \
    BACKUP_DB_PASSWORD
do
    if [[ -z "${!required_variable:-}" ]]; then
        echo "Missing required PostgreSQL bootstrap setting: ${required_variable}" >&2
        exit 1
    fi
done

psql \
    --set=ON_ERROR_STOP=1 \
    --username "${POSTGRES_USER}" \
    --dbname "${POSTGRES_DB}" \
    --set=app_db_name="${APP_DB_NAME}" \
    --set=app_db_user="${APP_DB_USER}" \
    --set=app_db_password="${APP_DB_PASSWORD}" \
    --set=backup_db_user="${BACKUP_DB_USER}" \
    --set=backup_db_password="${BACKUP_DB_PASSWORD}" <<'EOSQL'
SELECT format(
    'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT',
    :'app_db_user',
    :'app_db_password'
)
WHERE NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = :'app_db_user'
)
\gexec

SELECT format(
    'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT',
    :'backup_db_user',
    :'backup_db_password'
)
WHERE NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = :'backup_db_user'
)
\gexec

SELECT format(
    'CREATE DATABASE %I OWNER %I',
    :'app_db_name',
    :'app_db_user'
)
WHERE NOT EXISTS (
    SELECT 1
    FROM pg_database
    WHERE datname = :'app_db_name'
)
\gexec
EOSQL

psql \
    --set=ON_ERROR_STOP=1 \
    --username "${POSTGRES_USER}" \
    --dbname "${APP_DB_NAME}" \
    --set=app_db_name="${APP_DB_NAME}" \
    --set=app_db_user="${APP_DB_USER}" \
    --set=backup_db_user="${BACKUP_DB_USER}" <<'EOSQL'
GRANT CONNECT ON DATABASE :"app_db_name" TO :"backup_db_user";
GRANT USAGE ON SCHEMA public TO :"backup_db_user";

GRANT SELECT ON ALL TABLES IN SCHEMA public TO :"backup_db_user";
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO :"backup_db_user";

ALTER DEFAULT PRIVILEGES
    FOR ROLE :"app_db_user"
    IN SCHEMA public
    GRANT SELECT ON TABLES TO :"backup_db_user";

ALTER DEFAULT PRIVILEGES
    FOR ROLE :"app_db_user"
    IN SCHEMA public
    GRANT SELECT ON SEQUENCES TO :"backup_db_user";
EOSQL
