<?php

use App\Enums\PaymentMethod;
use App\Enums\PhotoboothSessionStatus;
use App\Models\ApplicationSetting;
use App\Models\PhotoboothSession;
use App\Models\Voucher;

test('a valid voucher redemption unlocks the session', function () {
    $voucher = Voucher::factory()->create(['usage_limit' => 1, 'usage_count' => 0]);
    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::New]);

    $response = $this->postJson(route('kiosk.sessions.voucher.store', $session->session_token), [
        'code' => $voucher->code,
    ]);

    $response->assertOk();
    $response->assertJson(['status' => PhotoboothSessionStatus::Paid->value]);

    expect($voucher->fresh()->usage_count)->toBe(1)
        ->and($session->fresh()->voucher_id)->toBe($voucher->id)
        ->and($session->fresh()->status)->toBe(PhotoboothSessionStatus::Paid);
});

test('a voucher redemption snapshots the price, currency, payment method, and required capture count on the session', function () {
    config(['photobooth.capture_shot_count' => 5]);

    $voucher = Voucher::factory()->create(['usage_limit' => 1, 'usage_count' => 0]);
    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::New]);

    $this->postJson(route('kiosk.sessions.voucher.store', $session->session_token), [
        'code' => $voucher->code,
    ])->assertOk();

    $session->refresh();

    expect((float) $session->price)->toBe(0.0)
        ->and($session->currency)->toBe('PHP')
        ->and($session->payment_method)->toBe(PaymentMethod::Voucher)
        ->and($session->required_capture_count)->toBe(5);
});

test('a real session snapshots currency and capture count at creation and keeps them when settings change before voucher redemption', function () {
    config(['photobooth.capture_shot_count' => 4]);

    $sessionToken = $this->postJson(route('kiosk.sessions.store'))->json('sessionToken');
    $session = PhotoboothSession::where('session_token', $sessionToken)->firstOrFail();

    ApplicationSetting::updateOrCreate(['key' => 'currency'], ['value' => 'USD']);
    config(['photobooth.capture_shot_count' => 10]);

    $voucher = Voucher::factory()->create(['usage_limit' => 1, 'usage_count' => 0]);

    $this->postJson(route('kiosk.sessions.voucher.store', $session->session_token), [
        'code' => $voucher->code,
    ])->assertOk();

    $session->refresh();

    expect($session->currency)->toBe('PHP')
        ->and($session->required_capture_count)->toBe(4);
});

test('an expired voucher is rejected without mutating usage_count or the session', function () {
    $voucher = Voucher::factory()->expired()->create(['usage_limit' => 1, 'usage_count' => 0]);
    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::New]);

    $response = $this->postJson(route('kiosk.sessions.voucher.store', $session->session_token), [
        'code' => $voucher->code,
    ]);

    $response->assertStatus(422);

    expect($voucher->fresh()->usage_count)->toBe(0)
        ->and($session->fresh()->voucher_id)->toBeNull()
        ->and($session->fresh()->status)->toBe(PhotoboothSessionStatus::New);
});

test('an inactive voucher is rejected without mutating usage_count or the session', function () {
    $voucher = Voucher::factory()->inactive()->create(['usage_limit' => 1, 'usage_count' => 0]);
    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::New]);

    $response = $this->postJson(route('kiosk.sessions.voucher.store', $session->session_token), [
        'code' => $voucher->code,
    ]);

    $response->assertStatus(422);

    expect($voucher->fresh()->usage_count)->toBe(0)
        ->and($session->fresh()->voucher_id)->toBeNull()
        ->and($session->fresh()->status)->toBe(PhotoboothSessionStatus::New);
});

test('an exhausted voucher is rejected without mutating usage_count or the session', function () {
    $voucher = Voucher::factory()->exhausted()->create(['usage_limit' => 1, 'usage_count' => 1]);
    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::New]);

    $response = $this->postJson(route('kiosk.sessions.voucher.store', $session->session_token), [
        'code' => $voucher->code,
    ]);

    $response->assertStatus(422);

    expect($voucher->fresh()->usage_count)->toBe(1)
        ->and($session->fresh()->voucher_id)->toBeNull()
        ->and($session->fresh()->status)->toBe(PhotoboothSessionStatus::New);
});

test('a voucher code with an invalid format is rejected', function () {
    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::New]);

    $response = $this->postJson(route('kiosk.sessions.voucher.store', $session->session_token), [
        'code' => '<script>alert(1)</script>',
    ]);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['code']);
});

test('an unknown voucher code is rejected', function () {
    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::New]);

    $response = $this->postJson(route('kiosk.sessions.voucher.store', $session->session_token), [
        'code' => 'DOES-NOT-EXIST',
    ]);

    $response->assertStatus(422);
    expect($session->fresh()->status)->toBe(PhotoboothSessionStatus::New);
});

test('concurrent redemption attempts at the usage limit boundary cannot exceed usage_count', function () {
    $voucher = Voucher::factory()->create(['usage_limit' => 1, 'usage_count' => 0]);

    $sessions = PhotoboothSession::factory()->count(2)->create(['status' => PhotoboothSessionStatus::New]);

    foreach ($sessions as $session) {
        $this->postJson(route('kiosk.sessions.voucher.store', $session->session_token), [
            'code' => $voucher->code,
        ]);
    }

    expect($voucher->fresh()->usage_count)->toBe(1)
        ->and($voucher->fresh()->usage_count)->toBeLessThanOrEqual($voucher->fresh()->usage_limit);

    $paidSessions = $sessions->filter(
        fn (PhotoboothSession $session) => $session->fresh()->status === PhotoboothSessionStatus::Paid,
    );

    expect($paidSessions)->toHaveCount(1);
});
