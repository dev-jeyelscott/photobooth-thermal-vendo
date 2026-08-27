<?php

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Fortify\Features;

test('security page is displayed', function () {
    $this->skipUnlessFortifyHas(Features::twoFactorAuthentication());

    Features::twoFactorAuthentication([
        'confirm' => true,
        'confirmPassword' => true,
    ]);

    Features::passkeys([
        'confirmPassword' => true,
    ]);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('security.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/security')
            ->where('canManagePasskeys', true)
            ->where('passkeys', [])
            ->where('canManageTwoFactor', true)
            ->where('twoFactorEnabled', false)
            ->has('activeSessions'),
        );
});

test('security page requires password confirmation when enabled', function () {
    $this->skipUnlessFortifyHas(Features::twoFactorAuthentication());

    $user = User::factory()->create();

    Features::twoFactorAuthentication([
        'confirm' => true,
        'confirmPassword' => true,
    ]);

    $response = $this->actingAs($user)
        ->get(route('security.edit'));

    $response->assertRedirect(route('password.confirm'));
});

test('security page renders without two factor when feature is disabled', function () {
    $this->skipUnlessFortifyHas(Features::twoFactorAuthentication());

    config(['fortify.features' => []]);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('security.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/security')
            ->where('canManagePasskeys', false)
            ->where('passkeys', [])
            ->where('canManageTwoFactor', false)
            ->missing('twoFactorEnabled')
            ->missing('requiresConfirmation'),
        );
});

test('non database session drivers fail safely for session listing', function () {
    config(['session.driver' => 'array']);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('security.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('activeSessions', null),
        );
});

test('security page exposes only database sessions owned by the authenticated user', function () {
    config([
        'session.driver' => 'database',
        'session.table' => 'sessions',
    ]);

    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    DB::table('sessions')->insert([
        [
            'id' => 'owned-security-session',
            'user_id' => $user->id,
            'ip_address' => '192.0.2.10',
            'user_agent' => 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/140.0 Safari/537.36',
            'payload' => '',
            'last_activity' => now()->subMinutes(5)->timestamp,
        ],
        [
            'id' => 'other-user-security-session',
            'user_id' => $otherUser->id,
            'ip_address' => '198.51.100.20',
            'user_agent' => 'Mozilla/5.0 Firefox/140.0',
            'payload' => '',
            'last_activity' => now()->subMinutes(10)->timestamp,
        ],
    ]);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('security.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where(
                'activeSessions',
                fn ($sessions) => collect($sessions)->contains(
                    fn (array $session): bool => $session['id'] === 'owned-security-session'
                        && $session['device'] === 'Chrome on Windows'
                        && $session['ipAddress'] === '192.0.2.10',
                ) && collect($sessions)->doesntContain(
                    fn (array $session): bool => $session['id'] === 'other-user-security-session',
                ),
            ),
        );
});

test('authenticated user can revoke an owned non current database session', function () {
    config([
        'session.driver' => 'database',
        'session.table' => 'sessions',
    ]);

    $user = User::factory()->create();

    DB::table('sessions')->insert([
        'id' => 'revocable-security-session',
        'user_id' => $user->id,
        'ip_address' => '192.0.2.11',
        'user_agent' => 'Mozilla/5.0',
        'payload' => '',
        'last_activity' => now()->subHour()->timestamp,
    ]);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->delete(route('security.sessions.destroy', [
            'sessionId' => 'revocable-security-session',
        ]))
        ->assertRedirect();

    expect(
        DB::table('sessions')
            ->where('id', 'revocable-security-session')
            ->exists(),
    )->toBeFalse();
});

test('authenticated user cannot revoke another users database session', function () {
    config([
        'session.driver' => 'database',
        'session.table' => 'sessions',
    ]);

    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    DB::table('sessions')->insert([
        'id' => 'foreign-security-session',
        'user_id' => $otherUser->id,
        'ip_address' => '198.51.100.42',
        'user_agent' => 'Mozilla/5.0',
        'payload' => '',
        'last_activity' => now()->subHour()->timestamp,
    ]);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->delete(route('security.sessions.destroy', [
            'sessionId' => 'foreign-security-session',
        ]))
        ->assertNotFound();

    expect(
        DB::table('sessions')
            ->where('id', 'foreign-security-session')
            ->exists(),
    )->toBeTrue();
});

test('password can be updated', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->from(route('security.edit'))
        ->put(route('user-password.update'), [
            'current_password' => 'password',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ]);

    $response
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('security.edit'));

    expect(Hash::check('new-password', $user->refresh()->password))->toBeTrue();
});

test('correct password must be provided to update password', function () {
    $user = User::factory()->create();

    $response = $this
        ->actingAs($user)
        ->from(route('security.edit'))
        ->put(route('user-password.update'), [
            'current_password' => 'wrong-password',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ]);

    $response
        ->assertSessionHasErrors('current_password')
        ->assertRedirect(route('security.edit'));
});
