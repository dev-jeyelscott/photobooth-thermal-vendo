<?php

use App\Enums\PhotoboothSessionStatus;
use App\Models\PhotoboothSession;
use App\Models\User;
use App\Models\Voucher;

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

test('admin can update a voucher expiration and usage limit without editing usage_count', function () {
    $user = User::factory()->create();
    $voucher = Voucher::factory()->create(['usage_limit' => 1, 'usage_count' => 1]);

    $response = $this->actingAs($user)->put(route('admin.vouchers.update', $voucher), [
        'code' => $voucher->code,
        'expires_at' => now()->addWeek()->toDateTimeString(),
        'usage_limit' => 10,
        'active' => '1',
        'usage_count' => 999,
    ]);

    $response->assertRedirect(route('admin.vouchers.index'));

    $voucher->refresh();
    expect($voucher->usage_limit)->toBe(10)
        ->and($voucher->usage_count)->toBe(1);
});

test('admin can toggle a voucher active flag', function () {
    $user = User::factory()->create();
    $voucher = Voucher::factory()->create(['active' => true]);

    $response = $this->actingAs($user)->patch(route('admin.vouchers.toggle', $voucher));

    $response->assertRedirect(route('admin.vouchers.index'));
    expect($voucher->fresh()->active)->toBeFalse();
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
    $voucher = Voucher::factory()->create(['code' => 'PROMO-CODE', 'usage_limit' => 1, 'usage_count' => 0]);
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
