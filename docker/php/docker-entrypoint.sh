#!/bin/sh

set -eu

# Prepare only runtime-writable Laravel directories. Database migrations remain
# an explicit release operation and are never executed from container startup.
mkdir -p \
    storage/app/private \
    storage/app/public \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/testing \
    storage/framework/views \
    storage/logs \
    bootstrap/cache

# Maintain Laravel's public-disk link without replacing an unexpected real path.
if [ ! -L public/storage ]; then
    if [ -e public/storage ]; then
        echo "public/storage exists but is not the expected symbolic link." >&2
        exit 1
    fi

    ln -s ../storage/app/public public/storage
fi

exec "$@"
