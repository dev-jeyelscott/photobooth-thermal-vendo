<?php

use App\Enums\PaymentStatus;
use App\Enums\PayMongoMode;
use App\Enums\PhotoboothSessionStatus;
use App\Jobs\ProcessPayMongoWebhookEvent;
use App\Models\Business;
use App\Models\Payment;
use App\Models\PayMongoAccount;
use App\Models\PayMongoWebhookEvent;
use App\Models\PhotoboothSession;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;

/**
 * Create one webhook-ready historical PayMongo account.
 */
function thPay005Account(
    Business $business,
    PayMongoMode $mode = PayMongoMode::Test,
): PayMongoAccount {
    $factory = PayMongoAccount::factory()
        ->for($business)
        ->webhookProvisioned();

    if ($mode === PayMongoMode::Live) {
        $factory = $factory->live();
    }

    return $factory->create([
        'mode' => $mode,
        'webhook_secret' => 'whsk_th_pay_005_secret',
    ]);
}

/**
 * Create one pending PayMongo payment with exact provider identifiers.
 */
function thPay005Payment(
    Business $business,
    PayMongoAccount $account,
    array $overrides = [],
): Payment {
    $session = PhotoboothSession::factory()
        ->for($business)
        ->create([
            'status' => PhotoboothSessionStatus::PaymentPending,
            'price' => '150.00',
            'currency' => 'PHP',
            'expires_at' => now()->addMinutes(15),
        ]);

    return Payment::factory()
        ->for($session, 'photoboothSession')
        ->payMongoQrPh($account)
        ->create([
            'amount' => '150.00',
            'currency' => 'PHP',
            'paymongo_payment_intent_id' => 'pi_th_pay_005',
            'paymongo_payment_method_id' => 'pm_th_pay_005',
            'paymongo_payment_id' => null,
            ...$overrides,
        ]);
}

/**
 * Build a PayMongo payment event using documented payment resource fields.
 *
 * @return array<string, mixed>
 */
function thPay005PaymentEvent(
    string $eventId,
    string $eventType,
    bool $livemode,
    int $amount = 15000,
    string $currency = 'PHP',
    string $paymentId = 'pay_th_pay_005',
    string $intentId = 'pi_th_pay_005',
): array {
    return [
        'data' => [
            'id' => $eventId,
            'type' => 'event',
            'attributes' => [
                'type' => $eventType,
                'livemode' => $livemode,
                'data' => [
                    'id' => $paymentId,
                    'type' => 'payment',
                    'attributes' => [
                        'amount' => $amount,
                        'currency' => $currency,
                        'status' => $eventType === 'payment.paid'
                            ? 'paid'
                            : 'failed',
                        'livemode' => $livemode,
                        'payment_intent_id' => $intentId,
                    ],
                ],
            ],
        ],
    ];
}

/**
 * Build the exact Paymongo-Signature header for a raw request body.
 */
function thPay005Signature(
    string $rawBody,
    string $secret,
    PayMongoMode $mode,
    ?int $timestamp = null,
): string {
    $timestamp ??= now()->getTimestamp();

    $signature = hash_hmac(
        'sha256',
        $timestamp.'.'.$rawBody,
        $secret,
    );

    return $mode === PayMongoMode::Test
        ? "t={$timestamp},te={$signature},li="
        : "t={$timestamp},te=,li={$signature}";
}

/**
 * Send the exact raw JSON webhook bytes to Laravel.
 */
function thPay005PostWebhook(
    PayMongoAccount $account,
    string $rawBody,
    string $signature,
) {
    return test()->call(
        'POST',
        route('webhooks.paymongo', [
            'paymongoAccount' => $account,
        ]),
        [],
        [],
        [],
        [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_PAYMONGO_SIGNATURE' => $signature,
        ],
        $rawBody,
    );
}

beforeEach(function () {
    Carbon::setTestNow('2026-08-28 22:45:00');

    config()->set(
        'services.paymongo.webhook_tolerance_seconds',
        300,
    );
});

afterEach(function () {
    Carbon::setTestNow();
});

test('valid Test signature persists and queues the webhook', function () {
    Queue::fake();

    $business = Business::factory()->create();
    $account = thPay005Account($business);
    thPay005Payment($business, $account);

    $payload = thPay005PaymentEvent(
        'evt_test_signature',
        'payment.paid',
        false,
    );

    $rawBody = json_encode(
        $payload,
        JSON_UNESCAPED_SLASHES,
    );

    expect($rawBody)->toBeString();

    thPay005PostWebhook(
        $account,
        $rawBody,
        thPay005Signature(
            $rawBody,
            $account->webhook_secret,
            PayMongoMode::Test,
        ),
    )->assertOk();

    $event = PayMongoWebhookEvent::firstOrFail();

    expect($event->provider_event_id)
        ->toBe('evt_test_signature')
        ->and($event->paymongo_account_id)
        ->toBe($account->id)
        ->and($event->livemode)
        ->toBeFalse();

    Queue::assertPushed(
        ProcessPayMongoWebhookEvent::class,
        fn (ProcessPayMongoWebhookEvent $job): bool =>
            $job->paymongoWebhookEventId === $event->id,
    );
});

test('valid Live signature uses only the li signature', function () {
    Queue::fake();

    $business = Business::factory()->create();

    $account = thPay005Account(
        $business,
        PayMongoMode::Live,
    );

    thPay005Payment($business, $account);

    $payload = thPay005PaymentEvent(
        'evt_live_signature',
        'payment.paid',
        true,
    );

    $rawBody = json_encode($payload);

    expect($rawBody)->toBeString();

    thPay005PostWebhook(
        $account,
        $rawBody,
        thPay005Signature(
            $rawBody,
            $account->webhook_secret,
            PayMongoMode::Live,
        ),
    )->assertOk();
});

test('cross-mode signature is rejected', function () {
    $business = Business::factory()->create();
    $account = thPay005Account($business);

    $payload = thPay005PaymentEvent(
        'evt_cross_mode',
        'payment.paid',
        false,
    );

    $rawBody = json_encode($payload);

    expect($rawBody)->toBeString();

    thPay005PostWebhook(
        $account,
        $rawBody,
        thPay005Signature(
            $rawBody,
            $account->webhook_secret,
            PayMongoMode::Live,
        ),
    )->assertUnauthorized();

    expect(PayMongoWebhookEvent::count())->toBe(0);
});

test('stale webhook signature is rejected', function () {
    $business = Business::factory()->create();
    $account = thPay005Account($business);

    $payload = thPay005PaymentEvent(
        'evt_stale',
        'payment.paid',
        false,
    );

    $rawBody = json_encode($payload);

    expect($rawBody)->toBeString();

    thPay005PostWebhook(
        $account,
        $rawBody,
        thPay005Signature(
            $rawBody,
            $account->webhook_secret,
            PayMongoMode::Test,
            now()->subMinutes(10)->getTimestamp(),
        ),
    )->assertUnauthorized();

    expect(PayMongoWebhookEvent::count())->toBe(0);
});

test('raw body mutation invalidates the signature', function () {
    $business = Business::factory()->create();
    $account = thPay005Account($business);

    $payload = thPay005PaymentEvent(
        'evt_raw_integrity',
        'payment.paid',
        false,
    );

    $signedBody = json_encode($payload);
    $mutatedBody = json_encode(
        $payload,
        JSON_PRETTY_PRINT,
    );

    expect($signedBody)->toBeString()
        ->and($mutatedBody)->toBeString()
        ->and($mutatedBody)->not->toBe($signedBody);

    thPay005PostWebhook(
        $account,
        $mutatedBody,
        thPay005Signature(
            $signedBody,
            $account->webhook_secret,
            PayMongoMode::Test,
        ),
    )->assertUnauthorized();
});

test('verified payload is encrypted at rest', function () {
    Queue::fake();

    $business = Business::factory()->create();
    $account = thPay005Account($business);
    thPay005Payment($business, $account);

    $payload = thPay005PaymentEvent(
        'evt_encrypted',
        'payment.paid',
        false,
        paymentId: 'pay_secret_payload_marker',
    );

    $rawBody = json_encode($payload);

    expect($rawBody)->toBeString();

    thPay005PostWebhook(
        $account,
        $rawBody,
        thPay005Signature(
            $rawBody,
            $account->webhook_secret,
            PayMongoMode::Test,
        ),
    )->assertOk();

    $rawStoredPayload = DB::table('paymongo_webhook_events')
        ->value('payload');

    expect($rawStoredPayload)
        ->toBeString()
        ->not->toContain('pay_secret_payload_marker')
        ->not->toContain('"payment.paid"');
});

test('duplicate provider event creates one durable inbox row', function () {
    Queue::fake();

    $business = Business::factory()->create();
    $account = thPay005Account($business);
    thPay005Payment($business, $account);

    $payload = thPay005PaymentEvent(
        'evt_duplicate',
        'payment.paid',
        false,
    );

    $rawBody = json_encode($payload);

    expect($rawBody)->toBeString();

    $signature = thPay005Signature(
        $rawBody,
        $account->webhook_secret,
        PayMongoMode::Test,
    );

    thPay005PostWebhook(
        $account,
        $rawBody,
        $signature,
    )->assertOk();

    thPay005PostWebhook(
        $account,
        $rawBody,
        $signature,
    )->assertOk();

    expect(
        PayMongoWebhookEvent::query()
            ->where('provider_event_id', 'evt_duplicate')
            ->count(),
    )->toBe(1);
});

test('payment paid event marks the Payment and active session exactly once', function () {
    $business = Business::factory()->create();
    $account = thPay005Account($business);
    $payment = thPay005Payment($business, $account);

    $event = PayMongoWebhookEvent::factory()->create([
        'paymongo_account_id' => $account->id,
        'provider_event_id' => 'evt_paid',
        'event_type' => 'payment.paid',
        'livemode' => false,
        'payload' => thPay005PaymentEvent(
            'evt_paid',
            'payment.paid',
            false,
        ),
    ]);

    app(
        App\Actions\Payments\ProcessPayMongoWebhookEvent::class,
    )->handle($event);

    $payment->refresh();
    $payment->photoboothSession->refresh();

    expect($payment->status)
        ->toBe(PaymentStatus::Success)
        ->and($payment->paymongo_payment_id)
        ->toBe('pay_th_pay_005')
        ->and($payment->paid_at)
        ->not->toBeNull()
        ->and($payment->photoboothSession->status)
        ->toBe(PhotoboothSessionStatus::Paid);

    $paidAt = $payment->paid_at;

    app(
        App\Actions\Payments\ProcessPayMongoWebhookEvent::class,
    )->handle($event->fresh());

    expect($payment->fresh()->paid_at)->toEqual($paidAt);
});

test('wrong amount cannot mark payment successful', function () {
    $business = Business::factory()->create();
    $account = thPay005Account($business);
    $payment = thPay005Payment($business, $account);

    $event = PayMongoWebhookEvent::factory()->create([
        'paymongo_account_id' => $account->id,
        'provider_event_id' => 'evt_wrong_amount',
        'event_type' => 'payment.paid',
        'livemode' => false,
        'payload' => thPay005PaymentEvent(
            'evt_wrong_amount',
            'payment.paid',
            false,
            amount: 14999,
        ),
    ]);

    expect(
        fn () => app(
            App\Actions\Payments\ProcessPayMongoWebhookEvent::class,
        )->handle($event),
    )->toThrow(RuntimeException::class);

    expect($payment->fresh()->status)
        ->toBe(PaymentStatus::Pending);
});

test('wrong currency cannot mark payment successful', function () {
    $business = Business::factory()->create();
    $account = thPay005Account($business);
    $payment = thPay005Payment($business, $account);

    $event = PayMongoWebhookEvent::factory()->create([
        'paymongo_account_id' => $account->id,
        'provider_event_id' => 'evt_wrong_currency',
        'event_type' => 'payment.paid',
        'livemode' => false,
        'payload' => thPay005PaymentEvent(
            'evt_wrong_currency',
            'payment.paid',
            false,
            currency: 'USD',
        ),
    ]);

    expect(
        fn () => app(
            App\Actions\Payments\ProcessPayMongoWebhookEvent::class,
        )->handle($event),
    )->toThrow(RuntimeException::class);

    expect($payment->fresh()->status)
        ->toBe(PaymentStatus::Pending);
});

test('webhook from another account cannot mutate the payment', function () {
    $business = Business::factory()->create();
    $otherBusiness = Business::factory()->create();

    $paymentAccount = thPay005Account($business);
    $webhookAccount = thPay005Account($otherBusiness);

    $payment = thPay005Payment(
        $business,
        $paymentAccount,
    );

    $event = PayMongoWebhookEvent::factory()->create([
        'paymongo_account_id' => $webhookAccount->id,
        'provider_event_id' => 'evt_wrong_account',
        'event_type' => 'payment.paid',
        'livemode' => false,
        'payload' => thPay005PaymentEvent(
            'evt_wrong_account',
            'payment.paid',
            false,
        ),
    ]);

    expect(
        fn () => app(
            App\Actions\Payments\ProcessPayMongoWebhookEvent::class,
        )->handle($event),
    )->toThrow(RuntimeException::class);

    expect($payment->fresh()->status)
        ->toBe(PaymentStatus::Pending);
});

test('late verified financial success does not reopen an expired session', function () {
    Log::spy();

    $business = Business::factory()->create();
    $account = thPay005Account($business);

    $payment = thPay005Payment(
        $business,
        $account,
        [
            'provider_expires_at' => now()->subMinute(),
        ],
    );

    $payment->photoboothSession->update([
        'status' => PhotoboothSessionStatus::Expired,
        'expires_at' => now()->subMinute(),
    ]);

    $event = PayMongoWebhookEvent::factory()->create([
        'paymongo_account_id' => $account->id,
        'provider_event_id' => 'evt_late_paid',
        'event_type' => 'payment.paid',
        'livemode' => false,
        'payload' => thPay005PaymentEvent(
            'evt_late_paid',
            'payment.paid',
            false,
        ),
    ]);

    app(
        App\Actions\Payments\ProcessPayMongoWebhookEvent::class,
    )->handle($event);

    expect($payment->fresh()->status)
        ->toBe(PaymentStatus::Success)
        ->and($payment->photoboothSession->fresh()->status)
        ->toBe(PhotoboothSessionStatus::Expired);

    Log::shouldHaveReceived('warning')
        ->withArgs(
            fn (string $message, array $context): bool =>
                str_contains($message, 'not reopened')
                && $context['payment_id'] === $payment->id,
        );
});

test('financial success overrides an earlier local failure but failure never overrides success', function () {
    $business = Business::factory()->create();
    $account = thPay005Account($business);
    $payment = thPay005Payment($business, $account);

    $failedEvent = PayMongoWebhookEvent::factory()->create([
        'paymongo_account_id' => $account->id,
        'provider_event_id' => 'evt_failure_first',
        'event_type' => 'payment.failed',
        'livemode' => false,
        'payload' => thPay005PaymentEvent(
            'evt_failure_first',
            'payment.failed',
            false,
        ),
    ]);

    app(
        App\Actions\Payments\ProcessPayMongoWebhookEvent::class,
    )->handle($failedEvent);

    expect($payment->fresh()->status)
        ->toBe(PaymentStatus::Failed);

    $paidEvent = PayMongoWebhookEvent::factory()->create([
        'paymongo_account_id' => $account->id,
        'provider_event_id' => 'evt_success_after_failure',
        'event_type' => 'payment.paid',
        'livemode' => false,
        'payload' => thPay005PaymentEvent(
            'evt_success_after_failure',
            'payment.paid',
            false,
        ),
    ]);

    app(
        App\Actions\Payments\ProcessPayMongoWebhookEvent::class,
    )->handle($paidEvent);

    expect($payment->fresh()->status)
        ->toBe(PaymentStatus::Success)
        ->and($payment->fresh()->failed_at)
        ->toBeNull();

    $lateFailure = PayMongoWebhookEvent::factory()->create([
        'paymongo_account_id' => $account->id,
        'provider_event_id' => 'evt_failure_after_success',
        'event_type' => 'payment.failed',
        'livemode' => false,
        'payload' => thPay005PaymentEvent(
            'evt_failure_after_success',
            'payment.failed',
            false,
        ),
    ]);

    app(
        App\Actions\Payments\ProcessPayMongoWebhookEvent::class,
    )->handle($lateFailure);

    expect($payment->fresh()->status)
        ->toBe(PaymentStatus::Success);
});

test('invalid signature logs no webhook secret or signature', function () {
    Log::spy();

    $business = Business::factory()->create();
    $account = thPay005Account($business);

    $payload = thPay005PaymentEvent(
        'evt_redaction',
        'payment.paid',
        false,
    );

    $rawBody = json_encode($payload);

    expect($rawBody)->toBeString();

    $fullSignature = str_repeat('a', 64);

    thPay005PostWebhook(
        $account,
        $rawBody,
        "t=".now()->timestamp.",te={$fullSignature},li=",
    )->assertUnauthorized();

    Log::shouldHaveReceived('warning')
        ->withArgs(function (
            string $message,
            array $context,
        ) use ($account, $fullSignature): bool {
            $encodedContext = json_encode($context);

            return str_contains($message, 'signature verification failed')
                && is_string($encodedContext)
                && ! str_contains(
                    $encodedContext,
                    $account->webhook_secret,
                )
                && ! str_contains(
                    $encodedContext,
                    $fullSignature,
                );
        });
});
