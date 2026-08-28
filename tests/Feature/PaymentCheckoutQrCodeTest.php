<?php

use App\Models\ApplicationSetting;
use App\Models\PhotoboothSession;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    ApplicationSetting::factory()->create([
        'key' => 'session_price',
        'value' => '150.00',
    ]);
});

test('payment checkout returns a server generated QR for the trusted Maya checkout URL', function () {
    Http::fake([
        '*/checkout/v1/checkouts' => Http::response([
            'checkoutId' => 'checkout-qr-123',
            'redirectUrl' => 'https://pg-sandbox.paymaya.com/checkout/checkout-qr-123',
        ], 200),
    ]);

    $session = PhotoboothSession::factory()->create();

    $response = $this->postJson(
        kioskSessionRoute(
            'kiosk.sessions.payments.store',
            $session,
        ),
    );

    $response->assertCreated()
        ->assertJsonPath(
            'checkoutUrl',
            'https://pg-sandbox.paymaya.com/checkout/checkout-qr-123',
        );

    $qrCode = $response->json('checkoutQrCode');

    expect($qrCode)
        ->toBeString()
        ->toStartWith('data:image/svg+xml;base64,');

    $svg = base64_decode(
        substr(
            $qrCode,
            strlen('data:image/svg+xml;base64,'),
        ),
        true,
    );

    expect($svg)
        ->toBeString()
        ->toContain('<svg');
});
