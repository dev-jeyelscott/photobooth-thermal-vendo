<?php

use App\Models\ApplicationSetting;
use App\Models\Business;
use App\Models\PhotoboothSession;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

test('session creation is rate limited per client', function () {
    config([
        'photobooth.rate_limits.session_creation_attempts_per_minute' => 2,
    ]);

    $business = Business::factory()->create();

    for ($attempt = 0; $attempt < 3; $attempt++) {
        $response = $this->postJson(
            businessRoute(
                'kiosk.sessions.store',
                $business,
            ),
        );

        if ($attempt < 2) {
            $response->assertCreated();
        } else {
            $response->assertTooManyRequests();
        }
    }
});

test('payment creation is rate limited per client', function () {
    config([
        'photobooth.rate_limits.payment_attempts_per_minute' => 2,
    ]);

    ApplicationSetting::factory()->create([
        'key' => 'session_price',
        'value' => '150.00',
    ]);

    Http::fake(function () {
        $checkoutId = 'checkout-'.Str::random(8);

        return Http::response([
            'checkoutId' => $checkoutId,
            'redirectUrl' => "https://pg-sandbox.paymaya.com/checkout/{$checkoutId}",
        ], 200);
    });

    $business = Business::factory()->create();

    $sessions = PhotoboothSession::factory()
        ->for($business)
        ->count(3)
        ->create();

    foreach ($sessions as $index => $session) {
        $response = $this->postJson(
            kioskSessionRoute(
                'kiosk.sessions.payments.store',
                $session,
            ),
        );

        if ($index < 2) {
            $response->assertCreated();
        } else {
            $response->assertTooManyRequests();
        }
    }
});

test('voucher redemption is rate limited per client', function () {
    config([
        'photobooth.rate_limits.voucher_attempts_per_minute' => 2,
    ]);

    $business = Business::factory()->create();

    $sessions = PhotoboothSession::factory()
        ->for($business)
        ->count(3)
        ->create();

    foreach ($sessions as $index => $session) {
        $response = $this->postJson(
            kioskSessionRoute(
                'kiosk.sessions.voucher.store',
                $session,
            ),
            [
                'code' => 'DOES-NOT-EXIST',
            ],
        );

        if ($index < 2) {
            $response->assertStatus(422);
        } else {
            $response->assertTooManyRequests();
        }
    }
});
