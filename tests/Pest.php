<?php

use App\Models\Business;
use App\Models\PhotoboothSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

pest()->extend(TestCase::class)
    ->in('Unit');

/**
 * Build a Business-prefixed route.
 *
 * When no Business is supplied, create a valid test Business. If the route
 * includes a sessionToken query parameter, prefer the Business that owns that
 * session so scoped public lookups continue exercising the real tenant
 * boundary.
 *
 * @param  array<string, mixed>  $parameters
 */
function businessRoute(
    string $name,
    ?Business $business = null,
    array $parameters = [],
): string {
    $sessionToken = $parameters['sessionToken'] ?? null;

    if (
        $business === null
        && is_string($sessionToken)
    ) {
        $business = PhotoboothSession::query()
            ->where('session_token', $sessionToken)
            ->first()
            ?->business;
    }

    $business ??= Business::factory()->create();

    return route($name, [
        'business' => $business,
        ...$parameters,
    ]);
}

/**
 * Build a Business-prefixed session route while preserving the public token.
 *
 * Existing sessions infer their authoritative Business from the database.
 * Unknown tokens receive a valid Business context so scoped route-model
 * binding can produce the expected 404 instead of URL generation failing.
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

        if ($business === null) {
            $business = PhotoboothSession::query()
                ->where('session_token', $sessionToken)
                ->first()
                ?->business;
        }
    }

    $business ??= Business::factory()->create();

    return route($name, [
        'business' => $business,
        'photoboothSession' => $sessionToken,
        ...$parameters,
    ]);
}
