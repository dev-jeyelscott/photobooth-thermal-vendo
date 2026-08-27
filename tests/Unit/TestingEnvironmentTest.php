<?php

test('phpunit testing configuration overrides inherited docker runtime environment', function () {
    expect(app()->environment())->toBe('testing')
        ->and(getenv('APP_ENV'))->toBe('testing')
        ->and(config('database.default'))->toBe('sqlite')
        ->and(config('database.connections.sqlite.database'))->toBe(':memory:')
        ->and(getenv('DB_CONNECTION'))->toBe('sqlite')
        ->and(config('session.driver'))->toBe('array')
        ->and(config('cache.default'))->toBe('array')
        ->and(config('queue.default'))->toBe('sync')
        ->and(config('mail.default'))->toBe('array');
});
