# syntax=docker/dockerfile:1.7

ARG PHP_VERSION=8.5.9
ARG NODE_VERSION=22.23.2
ARG COMPOSER_VERSION=2.10.2
ARG NGINX_VERSION=1.30.4

FROM php:${PHP_VERSION}-fpm-bookworm AS php-extensions

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libfreetype6-dev \
        libicu-dev \
        libjpeg62-turbo-dev \
        libpng-dev \
        libpq-dev \
        libwebp-dev \
        libzip-dev \
    && docker-php-ext-configure gd \
        --with-freetype \
        --with-jpeg \
        --with-webp \
    && docker-php-ext-install -j"$(nproc)" \
        bcmath \
        gd \
        intl \
        pcntl \
        pdo_pgsql \
        zip \
    && rm -rf /var/lib/apt/lists/*

FROM node:${NODE_VERSION}-bookworm-slim AS node

FROM composer:${COMPOSER_VERSION} AS composer

FROM php:${PHP_VERSION}-fpm-bookworm AS php-runtime

ARG APP_UID=1000
ARG APP_GID=1000

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        libfreetype6 \
        libicu72 \
        libjpeg62-turbo \
        libpng16-16 \
        libpq5 \
        libwebp7 \
        libzip4 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid "${APP_GID}" app \
    && useradd \
        --uid "${APP_UID}" \
        --gid "${APP_GID}" \
        --create-home \
        --shell /bin/bash \
        app

COPY --from=php-extensions /usr/local/lib/php/extensions/ /usr/local/lib/php/extensions/
COPY --from=php-extensions /usr/local/etc/php/conf.d/ /usr/local/etc/php/conf.d/

RUN mv "${PHP_INI_DIR}/php.ini-production" "${PHP_INI_DIR}/php.ini"

COPY docker/php/php.ini /usr/local/etc/php/conf.d/99-thermasnap.ini
COPY docker/php/www.conf /usr/local/etc/php-fpm.d/www.conf
COPY --chmod=755 docker/php/docker-entrypoint.sh /usr/local/bin/thermasnap-entrypoint

WORKDIR /var/www/html

ENTRYPOINT ["thermasnap-entrypoint"]
CMD ["php-fpm", "-F"]

FROM php-runtime AS development

COPY --from=composer /usr/bin/composer /usr/local/bin/composer
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules

RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

USER app

COPY --chown=app:app composer.json composer.lock ./

RUN composer install \
    --no-interaction \
    --prefer-dist \
    --no-progress \
    --no-scripts

COPY --chown=app:app package.json package-lock.json ./

RUN npm ci

COPY --chown=app:app . .

RUN composer dump-autoload --optimize --no-interaction

FROM development AS build

RUN npm run build \
    && composer install \
        --no-dev \
        --no-interaction \
        --prefer-dist \
        --optimize-autoloader \
        --no-progress \
    && rm -rf \
        node_modules \
        tests \
        .agents \
        .claude \
        .codex \
        .ai \
        .github \
        docs \
        deploy \
        resources/js/actions \
        resources/js/routes \
        resources/js/wayfinder \
    && rm -f public/hot \
    && mkdir -p storage/app/public \
    && if [ ! -e public/storage ]; then \
        ln -s ../storage/app/public public/storage; \
    fi

FROM php-runtime AS app

COPY --from=build --chown=app:app /var/www/html /var/www/html

USER app

FROM nginx:${NGINX_VERSION}-alpine AS nginx

WORKDIR /var/www/html

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /var/www/html/public /var/www/html/public

RUN mkdir -p /var/www/html/storage/app/public
