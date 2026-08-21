<?php

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PhotoboothSessionStatus;
use App\Models\ApplicationSetting;
use App\Models\Payment;
use App\Models\PhotoboothSession;
use Illuminate\Database\QueryException;
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

test('a payment request for an already paid session is rejected without creating a payment', function () {
    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::Paid]);

    $response = $this->postJson(route('kiosk.sessions.payments.store', $session->session_token));

    $response->assertStatus(409);
    expect(Payment::count())->toBe(0)
        ->and($session->fresh()->status)->toBe(PhotoboothSessionStatus::Paid);
});

test('a payment request for a completed session is rejected without creating a payment', function () {
    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::Completed]);

    $response = $this->postJson(route('kiosk.sessions.payments.store', $session->session_token));

    $response->assertStatus(409);
    expect(Payment::count())->toBe(0)
        ->and($session->fresh()->status)->toBe(PhotoboothSessionStatus::Completed);
});

test('a maya checkout snapshots the price, currency, payment method, and required capture count on the session', function () {
    config(['photobooth.capture_shot_count' => 4]);

    Http::fake([
        '*/checkout/v1/checkouts' => Http::response([
            'checkoutId' => 'checkout-123',
            'redirectUrl' => 'https://pg-sandbox.paymaya.com/checkout/checkout-123',
        ], 200),
    ]);

    $session = PhotoboothSession::factory()->create();

    $this->postJson(route('kiosk.sessions.payments.store', $session->session_token))->assertCreated();

    $session->refresh();

    expect((float) $session->price)->toBe(150.0)
        ->and($session->currency)->toBe('PHP')
        ->and($session->payment_method)->toBe(PaymentMethod::Maya)
        ->and($session->required_capture_count)->toBe(4);
});

test('changing the session price setting after checkout does not alter an already snapshotted session', function () {
    Http::fake([
        '*/checkout/v1/checkouts' => Http::response([
            'checkoutId' => 'checkout-123',
            'redirectUrl' => 'https://pg-sandbox.paymaya.com/checkout/checkout-123',
        ], 200),
    ]);

    $session = PhotoboothSession::factory()->create();

    $this->postJson(route('kiosk.sessions.payments.store', $session->session_token))->assertCreated();

    ApplicationSetting::where('key', 'session_price')->update(['value' => '999.00']);

    expect((float) $session->fresh()->price)->toBe(150.0);
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

test('a duplicate maya_checkout_id is rejected at the database layer', function () {
    Payment::factory()->create(['maya_checkout_id' => 'checkout-duplicate']);

    expect(fn () => Payment::factory()->create(['maya_checkout_id' => 'checkout-duplicate']))
        ->toThrow(QueryException::class);
});

test('a duplicate maya_payment_id is rejected at the database layer', function () {
    Payment::factory()->create(['maya_payment_id' => 'payment-duplicate']);

    expect(fn () => Payment::factory()->create(['maya_payment_id' => 'payment-duplicate']))
        ->toThrow(QueryException::class);
});

test('multiple pending payments without a maya reference can coexist', function () {
    Payment::factory()->count(2)->create([
        'maya_checkout_id' => null,
        'maya_payment_id' => null,
    ]);

    expect(Payment::count())->toBe(2);
});
