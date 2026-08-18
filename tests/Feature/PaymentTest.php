<?php

use App\Enums\PaymentStatus;
use App\Models\ApplicationSetting;
use App\Models\Payment;
use App\Models\PhotoboothSession;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    ApplicationSetting::factory()->create([
        'key' => 'session_price',
        'value' => '150.00',
    ]);
});

test('a maya checkout session is created and associated with the photobooth session', function () {
    Http::fake([
        '*/checkout/v1/checkouts' => Http::response([
            'checkoutId' => 'checkout-123',
            'redirectUrl' => 'https://pg-sandbox.paymaya.com/checkout/checkout-123',
        ], 200),
    ]);

    $session = PhotoboothSession::factory()->create();

    $response = $this->postJson(route('kiosk.sessions.payments.store', $session->session_token));

    $response->assertCreated();
    $response->assertJson([
        'checkoutUrl' => 'https://pg-sandbox.paymaya.com/checkout/checkout-123',
    ]);

    $payment = Payment::first();

    expect($payment)->not->toBeNull()
        ->and($payment->photobooth_session_id)->toBe($session->id)
        ->and($payment->status)->toBe(PaymentStatus::Pending)
        ->and($payment->maya_checkout_id)->toBe('checkout-123')
        ->and((float) $payment->amount)->toBe(150.0);
});

test('a second active payment request for the same session is rejected', function () {
    Http::fake([
        '*/checkout/v1/checkouts' => Http::response([
            'checkoutId' => 'checkout-123',
            'redirectUrl' => 'https://pg-sandbox.paymaya.com/checkout/checkout-123',
        ], 200),
    ]);

    $session = PhotoboothSession::factory()->create();
    Payment::factory()->for($session, 'photoboothSession')->create(['status' => PaymentStatus::Pending]);

    $response = $this->postJson(route('kiosk.sessions.payments.store', $session->session_token));

    $response->assertStatus(409);
    expect(Payment::count())->toBe(1);
});

test('a new payment request is allowed once the prior payment has failed', function () {
    Http::fake([
        '*/checkout/v1/checkouts' => Http::response([
            'checkoutId' => 'checkout-456',
            'redirectUrl' => 'https://pg-sandbox.paymaya.com/checkout/checkout-456',
        ], 200),
    ]);

    $session = PhotoboothSession::factory()->create();
    Payment::factory()->for($session, 'photoboothSession')->create(['status' => PaymentStatus::Failed]);

    $response = $this->postJson(route('kiosk.sessions.payments.store', $session->session_token));

    $response->assertCreated();
    expect(Payment::count())->toBe(2);
});

test('no maya secret key appears in the checkout response', function () {
    config(['services.maya.secret_key' => 'sk_super_secret_value']);

    Http::fake([
        '*/checkout/v1/checkouts' => Http::response([
            'checkoutId' => 'checkout-789',
            'redirectUrl' => 'https://pg-sandbox.paymaya.com/checkout/checkout-789',
        ], 200),
    ]);

    $session = PhotoboothSession::factory()->create();

    $response = $this->postJson(route('kiosk.sessions.payments.store', $session->session_token));

    $response->assertCreated();
    $response->assertDontSee('sk_super_secret_value');
});
