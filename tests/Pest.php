<?php

use App\Models\Business;
use App\Models\PhotoboothSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

pest()->extend(TestCase::class)
    ->in('Unit');

/**
 * Build a Business-prefixed route using the canonical route model.
 *
 * @param  array<string, mixed>  $parameters
 */
function businessRoute(
    string $name,
    Business $business,
    array $parameters = [],
): string {
    return route($name, [
        'business' => $business,
        ...$parameters,
    ]);
}

/**
 * Build a Business-prefixed session route while preserving the public token.
 *
 * @param  array<string, mixed>  $parameters
 */
function kioskSessionRoute(
    string $name,
    PhotoboothSession|string $session,
    ?Business $business = null,
    array $parameters = [],
): string {
    if ($session instanceof PhotoboothSession) {
        $business ??= $session->business;
        $sessionToken = $session->session_token;
    } else {
        $sessionToken = $session;
    }

    if ($business === null) {
        throw new InvalidArgumentException(
            'A Business is required when routing an unknown session token.',
        );
    }

    return route($name, [
        'business' => $business,
        'photoboothSession' => $sessionToken,
        ...$parameters,
    ]);
}
