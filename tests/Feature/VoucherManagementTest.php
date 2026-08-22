<?php

use App\Enums\PhotoboothSessionStatus;
use App\Models\PhotoboothSession;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Support\Facades\Route;

test('voucher management exposes the expected Laravel route contract', function () {
    $expectations = [
        'admin.vouchers.index' => ['admin/vouchers', ['GET', 'HEAD']],
        'admin.vouchers.create' => ['admin/vouchers/create', ['GET', 'HEAD']],
        'admin.vouchers.store' => ['admin/vouchers', ['POST']],
        'admin.vouchers.edit' => ['admin/vouchers/{voucher}/edit', ['GET', 'HEAD']],
        'admin.vouchers.update' => ['admin/vouchers/{voucher}', ['PUT', 'PATCH']],
        'admin.vouchers.destroy' => ['admin/vouchers/{voucher}', ['DELETE']],
        'admin.vouchers.toggle' => ['admin/vouchers/{voucher}/toggle', ['PATCH']],
    ];

    foreach ($expectations as $name => [$uri, $methods]) {
        $route = Route::getRoutes()->getByName($name);

        expect($route)->not->toBeNull();

        if ($route === null) {
            continue;
        }

        expect($route->uri())->toBe($uri)
            ->and($route->methods())->toBe($methods);
    }
});

test('voucher management routes require authentication', function () {
    $voucher = Voucher::factory()->create();

    $this->get(route('admin.vouchers.index'))->assertRedirect(route('login'));
    $this->get(route('admin.vouchers.create'))->assertRedirect(route('login'));
    $this->get(route('admin.vouchers.edit', $voucher))->assertRedirect(route('login'));
});

test('admin can list all vouchers with usage and expiration details', function () {
    $user = User::factory()->create();
    $active = Voucher::factory()->create(['code' => 'ACTIVE-CODE']);
    $inactive = Voucher::factory()->inactive()->create(['code' => 'INACTIVE-CODE']);

    $response = $this->actingAs($user)->get(route('admin.vouchers.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/vouchers/index')
        ->where('vouchers.0.code', $active->code)
        ->where('vouchers.0.active', true)
        ->where('vouchers.0.usageCount', $active->usage_count)
        ->where('vouchers.0.usageLimit', $active->usage_limit)
        ->where('vouchers.1.code', $inactive->code)
        ->where('vouchers.1.active', false)
    );
});

test('admin can create a voucher with a unique code, expiration, and usage limit', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('admin.vouchers.store'), [
        'code' => 'PROMO-2026',
        'expires_at' => now()->addMonth()->toDateTimeString(),
        'usage_limit' => 5,
        'active' => '1',
    ]);

    $response->assertRedirect(route('admin.vouchers.index'));

    $voucher = Voucher::sole();
    expect($voucher->code)->toBe('PROMO-2026')
        ->and($voucher->usage_limit)->toBe(5)
        ->and($voucher->usage_count)->toBe(0)
        ->and($voucher->active)->toBeTrue();
});

test('admin can explicitly create an inactive voucher', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('admin.vouchers.store'), [
        'code' => 'INACTIVE-PROMO',
        'usage_limit' => 1,
        'active' => '0',
    ]);

    $response->assertRedirect(route('admin.vouchers.index'));
    expect(Voucher::sole()->active)->toBeFalse();
});

test('admin cannot create two vouchers with the same code', function () {
    $user = User::factory()->create();
    Voucher::factory()->create(['code' => 'DUPLICATE']);

    $response = $this->actingAs($user)->post(route('admin.vouchers.store'), [
        'code' => 'DUPLICATE',
        'usage_limit' => 1,
    ]);

    $response->assertSessionHasErrors('code');
    expect(Voucher::where('code', 'DUPLICATE')->count())->toBe(1);
});

test('admin cannot set an expiration date in the past', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('admin.vouchers.store'), [
        'code' => 'EXPIRED-SOON',
        'expires_at' => now()->subDay()->toDateTimeString(),
        'usage_limit' => 1,
    ]);

    $response->assertSessionHasErrors('expires_at');
    expect(Voucher::where('code', 'EXPIRED-SOON')->exists())->toBeFalse();
});

test('admin can update a voucher through method spoofing without editing usage_count', function () {
    $user = User::factory()->create();
    $voucher = Voucher::factory()->create([
        'usage_limit' => 1,
        'usage_count' => 1,
        'active' => true,
    ]);

    $response = $this->actingAs($user)->post(route('admin.vouchers.update', $voucher), [
        '_method' => 'PUT',
        'code' => $voucher->code,
        'expires_at' => now()->addWeek()->toDateTimeString(),
        'usage_limit' => 10,
        'active' => '0',
        'usage_count' => 999,
    ]);

    $response->assertRedirect(route('admin.vouchers.index'));

    $voucher->refresh();
    expect($voucher->usage_limit)->toBe(10)
        ->and($voucher->usage_count)->toBe(1)
        ->and($voucher->active)->toBeFalse();
});

test('admin can create a voucher with a valid_from date not after expires_at', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('admin.vouchers.store'), [
        'code' => 'EARLY-BIRD',
        'valid_from' => now()->addDay()->toDateTimeString(),
        'expires_at' => now()->addMonth()->toDateTimeString(),
        'usage_limit' => 3,
    ]);

    $response->assertRedirect(route('admin.vouchers.index'));

    $voucher = Voucher::where('code', 'EARLY-BIRD')->sole();
    expect($voucher->valid_from)->not->toBeNull();
});

test('admin cannot set a valid_from date after expires_at', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('admin.vouchers.store'), [
        'code' => 'BAD-WINDOW',
        'valid_from' => now()->addMonth()->toDateTimeString(),
        'expires_at' => now()->addWeek()->toDateTimeString(),
        'usage_limit' => 1,
    ]);

    $response->assertSessionHasErrors('valid_from');
    expect(Voucher::where('code', 'BAD-WINDOW')->exists())->toBeFalse();
});

test('admin can update a voucher valid_from date', function () {
    $user = User::factory()->create();
    $voucher = Voucher::factory()->create(['expires_at' => now()->addMonth()]);

    $response = $this->actingAs($user)->put(route('admin.vouchers.update', $voucher), [
        'code' => $voucher->code,
        'valid_from' => now()->addDay()->toDateTimeString(),
        'expires_at' => now()->addMonth()->toDateTimeString(),
        'usage_limit' => $voucher->usage_limit,
        'active' => '1',
    ]);

    $response->assertRedirect(route('admin.vouchers.index'));
    expect($voucher->fresh()->valid_from)->not->toBeNull();
});

test('admin voucher edit view lists sessions that redeemed the voucher', function () {
    $user = User::factory()->create();
    $voucher = Voucher::factory()->create();
    $redeemingSession = PhotoboothSession::factory()->create([
        'voucher_id' => $voucher->id,
        'session_token' => 'REDEEMED-TOKEN',
    ]);
    PhotoboothSession::factory()->create();

    $response = $this->actingAs($user)->get(route('admin.vouchers.edit', $voucher));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/vouchers/edit')
        ->where('voucher.redemptions.0.sessionToken', $redeemingSession->session_token)
        ->where('voucher.redemptions.0.startedAt', $redeemingSession->started_at?->toIso8601String())
    );

    $indexResponse = $this->actingAs($user)->get(route('admin.vouchers.index'));

    $indexResponse->assertOk();
    $indexResponse->assertInertia(fn ($page) => $page
        ->component('admin/vouchers/index')
        ->where('vouchers.0.redemptions.0.sessionToken', $redeemingSession->session_token)
        ->where('vouchers.0.redemptions.0.startedAt', $redeemingSession->started_at?->toIso8601String())
    );
});

test('admin can toggle a voucher active flag', function () {
    $user = User::factory()->create();
    $voucher = Voucher::factory()->create(['active' => true]);

    $response = $this->actingAs($user)->patch(route('admin.vouchers.toggle', $voucher));

    $response->assertRedirect(route('admin.vouchers.index'));
    expect($voucher->fresh()->active)->toBeFalse();
});

test('admin can delete an unused voucher', function () {
    $user = User::factory()->create();
    $voucher = Voucher::factory()->create();

    $response = $this->actingAs($user)->delete(route('admin.vouchers.destroy', $voucher));

    $response->assertRedirect(route('admin.vouchers.index'));
    expect(Voucher::find($voucher->id))->toBeNull();
});

test('deleting a voucher with redemption history is rejected and preserves the session reference', function () {
    $user = User::factory()->create();
    $voucher = Voucher::factory()->create(['usage_count' => 1]);
    $session = PhotoboothSession::factory()->create(['voucher_id' => $voucher->id]);

    $response = $this->actingAs($user)
        ->from(route('admin.vouchers.index'))
        ->delete(route('admin.vouchers.destroy', $voucher));

    $response->assertRedirect(route('admin.vouchers.index'));
    $response->assertSessionHasErrors('voucher');

    expect(Voucher::find($voucher->id))->not->toBeNull()
        ->and($session->fresh()->voucher_id)->toBe($voucher->id);
});

test('redeeming a voucher before its valid_from date is rejected without mutating the voucher or session', function () {
    $voucher = Voucher::factory()->create([
        'valid_from' => now()->addDay(),
        'usage_limit' => 1,
        'usage_count' => 0,
    ]);
    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::New]);

    $response = $this->postJson(route('kiosk.sessions.voucher.store', $session->session_token), [
        'code' => $voucher->code,
    ]);

    $response->assertStatus(422);
    $response->assertJson([
        'message' => 'This voucher code is invalid or can no longer be used.',
        'status' => PhotoboothSessionStatus::New->value,
    ]);

    expect($voucher->fresh()->usage_count)->toBe(0)
        ->and($session->fresh()->status)->toBe(PhotoboothSessionStatus::New);
});

test('redeeming a voucher after its valid_from date succeeds', function () {
    $voucher = Voucher::factory()->create([
        'valid_from' => now()->subDay(),
        'usage_limit' => 1,
        'usage_count' => 0,
    ]);
    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::New]);

    $response = $this->postJson(route('kiosk.sessions.voucher.store', $session->session_token), [
        'code' => $voucher->code,
    ]);

    $response->assertOk();
    $response->assertJson(['status' => PhotoboothSessionStatus::Paid->value]);

    expect($voucher->fresh()->usage_count)->toBe(1)
        ->and($session->fresh()->status)->toBe(PhotoboothSessionStatus::Paid);
});

test('redeeming a voucher matches the code case- and whitespace-insensitively without altering the stored code', function () {
    $voucher = Voucher::factory()->create([
        'code' => 'PROMO-CODE',
        'usage_limit' => 1,
        'usage_count' => 0,
    ]);
    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::New]);

    $response = $this->postJson(route('kiosk.sessions.voucher.store', $session->session_token), [
        'code' => '  promo-code  ',
    ]);

    $response->assertOk();
    $response->assertJson(['status' => PhotoboothSessionStatus::Paid->value]);

    expect($voucher->fresh())
        ->code->toBe('PROMO-CODE')
        ->usage_count->toBe(1);
});
