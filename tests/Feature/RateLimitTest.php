<?php

use App\Models\ApplicationSetting;
use App\Models\PhotoboothSession;
use Illuminate\Support\Facades\Http;

test('payment creation is rate limited per client', function () {
    config(['photobooth.rate_limits.payment_attempts_per_minute' => 2]);

    ApplicationSetting::factory()->create([
        'key' => 'session_price',
        'value' => '150.00',
    ]);

    Http::fake([
        '*/checkout/v1/checkouts' => Http::response([
            'checkoutId' => 'checkout-123',
            'redirectUrl' => 'https://pg-sandbox.paymaya.com/checkout/checkout-123',
        ], 200),
    ]);

    $sessions = PhotoboothSession::factory()->count(3)->create();

    foreach ($sessions as $index => $session) {
        $response = $this->postJson(route('kiosk.sessions.payments.store', $session->session_token));

        if ($index < 2) {
            $response->assertCreated();
        } else {
            $response->assertTooManyRequests();
        }
    }
});

test('voucher redemption is rate limited per client', function () {
    config(['photobooth.rate_limits.voucher_attempts_per_minute' => 2]);

    $sessions = PhotoboothSession::factory()->count(3)->create();

    foreach ($sessions as $index => $session) {
        $response = $this->postJson(route('kiosk.sessions.voucher.store', $session->session_token), [
            'code' => 'DOES-NOT-EXIST',
        ]);

        if ($index < 2) {
            $response->assertStatus(422);
        } else {
            $response->assertTooManyRequests();
        }
    }
});
