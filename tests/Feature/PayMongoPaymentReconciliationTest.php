<?php

use App\Actions\Payments\ReconcilePayMongoPayment;
use App\Enums\PaymentStatus;
use App\Enums\PayMongoMode;
use App\Enums\PhotoboothSessionStatus;
use App\Models\Business;
use App\Models\Payment;
use App\Models\PayMongoAccount;
use App\Models\PhotoboothSession;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    config()->set(
        'services.paymongo.api_base_url',
        'https://api.paymongo.com',
    );

    Http::preventStrayRequests();
});

/**
 * Create one ready Test account and one pending payment for reconciliation.
 *
 * @return array{0: PayMongoAccount, 1: Payment}
 */
function thPay005ReconciliationPayment(): array
{
    $business = Business::factory()->create();

    $account = PayMongoAccount::factory()
        ->for($business)
        ->webhookProvisioned()
        ->create([
            'mode' => PayMongoMode::Test,
            'secret_key' => 'sk_test_reconcile_exact_account',
        ]);

    $session = PhotoboothSession::factory()
        ->for($business)
        ->create([
            'status' => PhotoboothSessionStatus::PaymentPending,
            'price' => '150.00',
            'currency' => 'PHP',
            'expires_at' => now()->addMinutes(15),
        ]);

    $payment = Payment::factory()
        ->for($session, 'photoboothSession')
        ->payMongoQrPh($account)
        ->create([
            'amount' => '150.00',
            'currency' => 'PHP',
            'paymongo_payment_intent_id' => 'pi_reconcile',
            'paymongo_payment_method_id' => 'pm_reconcile',
            'paymongo_payment_id' => null,
        ]);

    return [$account, $payment];
}

test('reconciliation retrieves the exact historical Payment Intent account', function () {
    [$account, $payment] = thPay005ReconciliationPayment();

    Http::fake([
        'https://api.paymongo.com/v1/payment_intents/pi_reconcile' =>
            Http::response([
                'data' => [
                    'id' => 'pi_reconcile',
                    'type' => 'payment_intent',
                    'attributes' => [
                        'amount' => 15000,
                        'currency' => 'PHP',
                        'status' => 'succeeded',
                        'livemode' => false,
                        'payments' => [
                            ['id' => 'pay_reconciled'],
                        ],
                    ],
                ],
            ]),
    ]);

    app(ReconcilePayMongoPayment::class)->handle($payment);

    expect($payment->fresh()->status)
        ->toBe(PaymentStatus::Success)
        ->and($payment->fresh()->paymongo_payment_id)
        ->toBe('pay_reconciled')
        ->and($payment->photoboothSession->fresh()->status)
        ->toBe(PhotoboothSessionStatus::Paid);

    Http::assertSent(
        fn (HttpRequest $request): bool =>
            $request->method() === 'GET'
            && $request->url()
                === 'https://api.paymongo.com/v1/payment_intents/pi_reconcile'
            && $request->hasHeader(
                'Authorization',
                'Basic '.base64_encode(
                    $account->secret_key.':',
                ),
            ),
    );
});

test('reconciliation refuses amount mismatch', function () {
    [, $payment] = thPay005ReconciliationPayment();

    Http::fake([
        'https://api.paymongo.com/v1/payment_intents/pi_reconcile' =>
            Http::response([
                'data' => [
                    'id' => 'pi_reconcile',
                    'type' => 'payment_intent',
                    'attributes' => [
                        'amount' => 14999,
                        'currency' => 'PHP',
                        'status' => 'succeeded',
                        'livemode' => false,
                        'payments' => [
                            ['id' => 'pay_wrong_amount'],
                        ],
                    ],
                ],
            ]),
    ]);

    expect(
        fn () => app(
            ReconcilePayMongoPayment::class,
        )->handle($payment),
    )->toThrow(RuntimeException::class);

    expect($payment->fresh()->status)
        ->toBe(PaymentStatus::Pending);
});

test('reconciliation refuses currency mismatch', function () {
    [, $payment] = thPay005ReconciliationPayment();

    Http::fake([
        'https://api.paymongo.com/v1/payment_intents/pi_reconcile' =>
            Http::response([
                'data' => [
                    'id' => 'pi_reconcile',
                    'type' => 'payment_intent',
                    'attributes' => [
                        'amount' => 15000,
                        'currency' => 'USD',
                        'status' => 'succeeded',
                        'livemode' => false,
                        'payments' => [
                            ['id' => 'pay_wrong_currency'],
                        ],
                    ],
                ],
            ]),
    ]);

    expect(
        fn () => app(
            ReconcilePayMongoPayment::class,
        )->handle($payment),
    )->toThrow(RuntimeException::class);

    expect($payment->fresh()->status)
        ->toBe(PaymentStatus::Pending);
});

test('reconciliation refuses Test Live mode mismatch', function () {
    [, $payment] = thPay005ReconciliationPayment();

    Http::fake([
        'https://api.paymongo.com/v1/payment_intents/pi_reconcile' =>
            Http::response([
                'data' => [
                    'id' => 'pi_reconcile',
                    'type' => 'payment_intent',
                    'attributes' => [
                        'amount' => 15000,
                        'currency' => 'PHP',
                        'status' => 'succeeded',
                        'livemode' => true,
                        'payments' => [
                            ['id' => 'pay_wrong_mode'],
                        ],
                    ],
                ],
            ]),
    ]);

    expect(
        fn () => app(
            ReconcilePayMongoPayment::class,
        )->handle($payment),
    )->toThrow(RuntimeException::class);

    expect($payment->fresh()->status)
        ->toBe(PaymentStatus::Pending);
});

test('expired local QR with awaiting payment method becomes cancelled', function () {
    [, $payment] = thPay005ReconciliationPayment();

    $payment->update([
        'provider_expires_at' => now()->subMinute(),
    ]);

    Http::fake([
        'https://api.paymongo.com/v1/payment_intents/pi_reconcile' =>
            Http::response([
                'data' => [
                    'id' => 'pi_reconcile',
                    'type' => 'payment_intent',
                    'attributes' => [
                        'amount' => 15000,
                        'currency' => 'PHP',
                        'status' => 'awaiting_payment_method',
                        'livemode' => false,
                        'payments' => [],
                    ],
                ],
            ]),
    ]);

    app(ReconcilePayMongoPayment::class)->handle($payment);

    expect($payment->fresh()->status)
        ->toBe(PaymentStatus::Cancelled)
        ->and($payment->fresh()->provider_status)
        ->toBe('reconciled:awaiting_payment_method');
});

test('processing Payment Intent remains pending', function () {
    [, $payment] = thPay005ReconciliationPayment();

    Http::fake([
        'https://api.paymongo.com/v1/payment_intents/pi_reconcile' =>
            Http::response([
                'data' => [
                    'id' => 'pi_reconcile',
                    'type' => 'payment_intent',
                    'attributes' => [
                        'amount' => 15000,
                        'currency' => 'PHP',
                        'status' => 'processing',
                        'livemode' => false,
                        'payments' => [],
                    ],
                ],
            ]),
    ]);

    app(ReconcilePayMongoPayment::class)->handle($payment);

    expect($payment->fresh()->status)
        ->toBe(PaymentStatus::Pending)
        ->and($payment->fresh()->provider_status)
        ->toBe('reconciled:processing');
});

test('late reconciled success records money without reopening expired session', function () {
    [, $payment] = thPay005ReconciliationPayment();

    $payment->photoboothSession->update([
        'status' => PhotoboothSessionStatus::Expired,
        'expires_at' => now()->subMinute(),
    ]);

    Http::fake([
        'https://api.paymongo.com/v1/payment_intents/pi_reconcile' =>
            Http::response([
                'data' => [
                    'id' => 'pi_reconcile',
                    'type' => 'payment_intent',
                    'attributes' => [
                        'amount' => 15000,
                        'currency' => 'PHP',
                        'status' => 'succeeded',
                        'livemode' => false,
                        'payments' => [
                            ['id' => 'pay_late_success'],
                        ],
                    ],
                ],
            ]),
    ]);

    app(ReconcilePayMongoPayment::class)->handle($payment);

    expect($payment->fresh()->status)
        ->toBe(PaymentStatus::Success)
        ->and($payment->photoboothSession->fresh()->status)
        ->toBe(PhotoboothSessionStatus::Expired);
});
