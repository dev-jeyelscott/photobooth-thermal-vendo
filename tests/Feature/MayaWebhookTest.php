<?php

use App\Enums\PaymentStatus;
use App\Enums\PhotoboothSessionStatus;
use App\Models\Payment;
use App\Models\PhotoboothSession;

beforeEach(function () {
    config(['services.maya.webhook_secret' => 'whsec_test_secret']);
});

test('a successful payment webhook marks the payment and session as paid', function () {
    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::PaymentPending]);
    $payment = Payment::factory()->for($session, 'photoboothSession')->create([
        'status' => PaymentStatus::Pending,
        'maya_checkout_id' => 'checkout-123',
        'amount' => '150.00',
    ]);

    $payload = [
        'id' => 'payment-abc',
        'checkoutId' => 'checkout-123',
        'status' => 'PAYMENT_SUCCESS',
        'amount' => ['value' => '150.00', 'currency' => 'PHP'],
    ];

    $signature = hash_hmac('sha256', json_encode($payload), 'whsec_test_secret');

    $response = $this->postJson(route('webhooks.maya'), $payload, [
        'Maya-Webhook-Signature' => $signature,
    ]);

    $response->assertOk();

    $payment->refresh();
    $session->refresh();

    expect($payment->status)->toBe(PaymentStatus::Success)
        ->and($payment->maya_payment_id)->toBe('payment-abc')
        ->and($session->status)->toBe(PhotoboothSessionStatus::Paid);
});

test('a replayed success webhook does not duplicate the payment or re-apply the session transition', function () {
    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::PaymentPending]);
    $payment = Payment::factory()->for($session, 'photoboothSession')->create([
        'status' => PaymentStatus::Pending,
        'maya_checkout_id' => 'checkout-123',
        'amount' => '150.00',
    ]);

    $payload = [
        'id' => 'payment-abc',
        'checkoutId' => 'checkout-123',
        'status' => 'PAYMENT_SUCCESS',
        'amount' => ['value' => '150.00', 'currency' => 'PHP'],
    ];

    $signature = hash_hmac('sha256', json_encode($payload), 'whsec_test_secret');

    $this->postJson(route('webhooks.maya'), $payload, ['Maya-Webhook-Signature' => $signature])
        ->assertOk();

    $response = $this->postJson(route('webhooks.maya'), $payload, ['Maya-Webhook-Signature' => $signature]);

    $response->assertOk();

    expect(Payment::count())->toBe(1);

    $payment->refresh();
    $session->refresh();

    expect($payment->status)->toBe(PaymentStatus::Success)
        ->and($session->status)->toBe(PhotoboothSessionStatus::Paid);
});

test('a failed payment webhook marks the payment as failed without transitioning the session', function () {
    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::PaymentPending]);
    $payment = Payment::factory()->for($session, 'photoboothSession')->create([
        'status' => PaymentStatus::Pending,
        'maya_checkout_id' => 'checkout-456',
        'amount' => '150.00',
    ]);

    $payload = [
        'id' => 'payment-def',
        'checkoutId' => 'checkout-456',
        'status' => 'PAYMENT_FAILED',
        'amount' => ['value' => '150.00', 'currency' => 'PHP'],
    ];

    $signature = hash_hmac('sha256', json_encode($payload), 'whsec_test_secret');

    $response = $this->postJson(route('webhooks.maya'), $payload, ['Maya-Webhook-Signature' => $signature]);

    $response->assertOk();

    $payment->refresh();
    $session->refresh();

    expect($payment->status)->toBe(PaymentStatus::Failed)
        ->and($session->status)->toBe(PhotoboothSessionStatus::PaymentPending);
});

test('a cancelled payment webhook marks the payment as cancelled without transitioning the session', function () {
    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::PaymentPending]);
    $payment = Payment::factory()->for($session, 'photoboothSession')->create([
        'status' => PaymentStatus::Pending,
        'maya_checkout_id' => 'checkout-789',
        'amount' => '150.00',
    ]);

    $payload = [
        'id' => 'payment-ghi',
        'checkoutId' => 'checkout-789',
        'status' => 'PAYMENT_CANCELLED',
        'amount' => ['value' => '150.00', 'currency' => 'PHP'],
    ];

    $signature = hash_hmac('sha256', json_encode($payload), 'whsec_test_secret');

    $response = $this->postJson(route('webhooks.maya'), $payload, ['Maya-Webhook-Signature' => $signature]);

    $response->assertOk();

    $payment->refresh();
    $session->refresh();

    expect($payment->status)->toBe(PaymentStatus::Cancelled)
        ->and($session->status)->toBe(PhotoboothSessionStatus::PaymentPending);
});

test('a webhook request with an invalid signature is rejected and mutates nothing', function () {
    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::PaymentPending]);
    $payment = Payment::factory()->for($session, 'photoboothSession')->create([
        'status' => PaymentStatus::Pending,
        'maya_checkout_id' => 'checkout-999',
        'amount' => '150.00',
    ]);

    $payload = [
        'id' => 'payment-jkl',
        'checkoutId' => 'checkout-999',
        'status' => 'PAYMENT_SUCCESS',
        'amount' => ['value' => '150.00', 'currency' => 'PHP'],
    ];

    $response = $this->postJson(route('webhooks.maya'), $payload, [
        'Maya-Webhook-Signature' => 'not-the-right-signature',
    ]);

    $response->assertStatus(401);

    $payment->refresh();
    $session->refresh();

    expect($payment->status)->toBe(PaymentStatus::Pending)
        ->and($session->status)->toBe(PhotoboothSessionStatus::PaymentPending);
});

test('a webhook with an amount mismatch is rejected without mutating the payment', function () {
    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::PaymentPending]);
    $payment = Payment::factory()->for($session, 'photoboothSession')->create([
        'status' => PaymentStatus::Pending,
        'maya_checkout_id' => 'checkout-321',
        'amount' => '150.00',
    ]);

    $payload = [
        'id' => 'payment-mno',
        'checkoutId' => 'checkout-321',
        'status' => 'PAYMENT_SUCCESS',
        'amount' => ['value' => '50.00', 'currency' => 'PHP'],
    ];

    $signature = hash_hmac('sha256', json_encode($payload), 'whsec_test_secret');

    $response = $this->postJson(route('webhooks.maya'), $payload, ['Maya-Webhook-Signature' => $signature]);

    $response->assertStatus(422);

    $payment->refresh();
    $session->refresh();

    expect($payment->status)->toBe(PaymentStatus::Pending)
        ->and($session->status)->toBe(PhotoboothSessionStatus::PaymentPending);
});

test('a webhook referencing an unknown checkout id is rejected without mutating any records', function () {
    $payload = [
        'id' => 'payment-unknown',
        'checkoutId' => 'checkout-does-not-exist',
        'status' => 'PAYMENT_SUCCESS',
        'amount' => ['value' => '150.00', 'currency' => 'PHP'],
    ];

    $signature = hash_hmac('sha256', json_encode($payload), 'whsec_test_secret');

    $response = $this->postJson(route('webhooks.maya'), $payload, ['Maya-Webhook-Signature' => $signature]);

    $response->assertStatus(422);
    expect(Payment::count())->toBe(0);
});
