<?php

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PayMongoMode;
use App\Enums\PhotoboothSessionStatus;
use App\Models\ApplicationSetting;
use App\Models\Business;
use App\Models\Payment;
use App\Models\PayMongoAccount;
use App\Models\PhotoboothSession;
use Illuminate\Database\QueryException;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;

/**
 * Create and select a payment-ready Test PayMongo account for one Business.
 */
function thPay004ReadyAccount(
    Business $business,
    string $publicKey = 'pk_test_tenant-public-1234',
    string $secretKey = 'sk_test_tenant-secret-5678',
    string $webhookSecret = 'whsk_tenant-webhook-9012',
): PayMongoAccount {
    $account = PayMongoAccount::factory()
        ->for($business)
        ->webhookProvisioned()
        ->create([
            'public_key' => $publicKey,
            'secret_key' => $secretKey,
            'public_key_last4' => substr($publicKey, -4),
            'secret_key_last4' => substr($secretKey, -4),
            'webhook_secret' => $webhookSecret,
        ]);

    $business->forceFill([
        'active_paymongo_mode' => PayMongoMode::Test,
        'test_paymongo_account_id' => $account->id,
    ])->save();

    return $account;
}

/**
 * Create a payable session with durable payment snapshots.
 *
 * @param  array<string, mixed>  $overrides
 */
function thPay004Session(
    Business $business,
    array $overrides = [],
): PhotoboothSession {
    return PhotoboothSession::factory()
        ->for($business)
        ->create([
            'price' => '150.01',
            'currency' => 'PHP',
            'required_capture_count' => 4,
            'expires_at' => now()->addMinutes(15),
            ...$overrides,
        ]);
}

/**
 * Fake a complete PayMongo QR Ph creation sequence.
 */
function thPay004FakeSuccessfulProviderFlow(
    string $intentId = 'pi_test_123',
    string $paymentMethodId = 'pm_test_123',
    string $paymentId = 'pay_test_123',
    string $clientKey = 'pi_test_123_client_private-value',
    string $qrImageUrl = 'data:image/png;base64,cXJwaC10ZXN0',
): void {
    Http::fake(function (HttpRequest $request) use (
        $intentId,
        $paymentMethodId,
        $paymentId,
        $clientKey,
        $qrImageUrl,
    ) {
        if ($request->url() === 'https://api.paymongo.com/v1/payment_intents') {
            return Http::response([
                'data' => [
                    'id' => $intentId,
                    'attributes' => [
                        'client_key' => $clientKey,
                        'status' => 'awaiting_payment_method',
                        'payments' => [],
                    ],
                ],
            ]);
        }

        if ($request->url() === 'https://api.paymongo.com/v1/payment_methods') {
            return Http::response([
                'data' => [
                    'id' => $paymentMethodId,
                    'attributes' => ['type' => 'qrph'],
                ],
            ]);
        }

        if (
            $request->url()
                === "https://api.paymongo.com/v1/payment_intents/{$intentId}/attach"
        ) {
            return Http::response([
                'data' => [
                    'id' => $intentId,
                    'attributes' => [
                        'status' => 'awaiting_next_action',
                        'payments' => [['id' => $paymentId]],
                        'next_action' => [
                            'code' => ['image_url' => $qrImageUrl],
                        ],
                    ],
                ],
            ]);
        }

        return Http::response([], 404);
    });
}

beforeEach(function () {
    config()->set('services.paymongo.api_base_url', 'https://api.paymongo.com');
    config()->set(
        'services.paymongo.platform.public_key',
        'pk_test_platform-do-not-use',
    );
    config()->set(
        'services.paymongo.platform.secret_key',
        'sk_test_platform-do-not-use',
    );

    Http::preventStrayRequests();
});

afterEach(function () {
    Carbon::setTestNow();
});

test('tenant QR Ph payment returns safe QR metadata', function () {
    $business = Business::factory()->create();
    $account = thPay004ReadyAccount($business);
    $session = thPay004Session($business);

    thPay004FakeSuccessfulProviderFlow();

    $response = $this->postJson(
        kioskSessionRoute('kiosk.sessions.payments.store', $session),
    );

    $response->assertCreated()
        ->assertJsonPath('payment.amount', '150.01')
        ->assertJsonPath('payment.currency', 'PHP')
        ->assertJsonPath('payment.providerStatus', 'awaiting_next_action')
        ->assertJsonPath(
            'qrImageUrl',
            'data:image/png;base64,cXJwaC10ZXN0',
        );

    $payment = Payment::firstOrFail();

    expect($payment->paymongo_account_id)->toBe($account->id)
        ->and($payment->method)->toBe(PaymentMethod::PayMongoQrPh)
        ->and($payment->paymongo_payment_intent_id)->toBe('pi_test_123')
        ->and($payment->paymongo_payment_method_id)->toBe('pm_test_123')
        ->and($payment->paymongo_payment_id)->toBe('pay_test_123')
        ->and($session->fresh()->status)
        ->toBe(PhotoboothSessionStatus::PaymentPending);

    expect($response->getContent())
        ->not->toContain($account->secret_key)
        ->not->toContain($account->public_key)
        ->not->toContain((string) $account->webhook_secret)
        ->not->toContain('pi_test_123_client_private-value')
        ->not->toContain('sk_test_platform-do-not-use');
});

test('provider requests use exact tenant auth payload and idempotency', function () {
    Carbon::setTestNow('2026-08-28 10:00:00');

    $business = Business::factory()->create();
    $account = thPay004ReadyAccount($business);
    $session = thPay004Session($business, [
        'expires_at' => now()->addSeconds(120),
    ]);

    thPay004FakeSuccessfulProviderFlow();

    $this->postJson(
        kioskSessionRoute('kiosk.sessions.payments.store', $session),
    )->assertCreated();

    $payment = Payment::firstOrFail();
    $baseKey = $payment->provider_idempotency_key;

    Http::assertSent(function (HttpRequest $request) use (
        $account,
        $baseKey,
    ): bool {
        $attributes = $request->data()['data']['attributes'] ?? [];

        return $request->url()
                === 'https://api.paymongo.com/v1/payment_intents'
            && $request->hasHeader(
                'Authorization',
                'Basic '.base64_encode($account->secret_key.':'),
            )
            && $request->hasHeader(
                'Idempotency-Key',
                $baseKey.'-intent',
            )
            && ($attributes['amount'] ?? null) === 15001
            && ($attributes['currency'] ?? null) === 'PHP'
            && ($attributes['payment_method_allowed'] ?? null) === ['qrph'];
    });

    Http::assertSent(function (HttpRequest $request) use (
        $account,
        $baseKey,
    ): bool {
        $attributes = $request->data()['data']['attributes'] ?? [];

        return $request->url()
                === 'https://api.paymongo.com/v1/payment_methods'
            && $request->hasHeader(
                'Authorization',
                'Basic '.base64_encode($account->public_key.':'),
            )
            && $request->hasHeader(
                'Idempotency-Key',
                $baseKey.'-method',
            )
            && ($attributes['type'] ?? null) === 'qrph'
            && ($attributes['expiry_seconds'] ?? null) === 120;
    });

    Http::assertSent(function (HttpRequest $request) use (
        $account,
        $baseKey,
    ): bool {
        $attributes = $request->data()['data']['attributes'] ?? [];

        return str_ends_with($request->url(), '/pi_test_123/attach')
            && $request->hasHeader(
                'Authorization',
                'Basic '.base64_encode($account->public_key.':'),
            )
            && $request->hasHeader(
                'Idempotency-Key',
                $baseKey.'-attach',
            )
            && ($attributes['payment_method'] ?? null) === 'pm_test_123'
            && ($attributes['client_key'] ?? null)
                === 'pi_test_123_client_private-value';
    });
});

test('unready tenant account never falls back to platform keys', function () {
    $business = Business::factory()->create();

    $account = PayMongoAccount::factory()
        ->for($business)
        ->verified()
        ->create();

    $business->forceFill([
        'test_paymongo_account_id' => $account->id,
    ])->save();

    $session = thPay004Session($business);

    $this->postJson(
        kioskSessionRoute('kiosk.sessions.payments.store', $session),
    )->assertStatus(409);

    expect(Payment::count())->toBe(0);

    Http::assertNothingSent();
});

test('decimal money is converted to integer centavos', function () {
    $business = Business::factory()->create();
    thPay004ReadyAccount($business);

    $session = thPay004Session($business, ['price' => '1234.56']);

    thPay004FakeSuccessfulProviderFlow();

    $this->postJson(
        kioskSessionRoute('kiosk.sessions.payments.store', $session),
    )->assertCreated();

    Http::assertSent(fn (HttpRequest $request): bool => $request->url() === 'https://api.paymongo.com/v1/payment_intents'
        && ($request->data()['data']['attributes']['amount'] ?? null)
            === 123456
    );
});

test('QR expiry is bounded by session time and PayMongo maximum', function (
    int $remaining,
    int $expected,
) {
    Carbon::setTestNow('2026-08-28 10:00:00');

    $business = Business::factory()->create();
    thPay004ReadyAccount($business);

    $session = thPay004Session($business, [
        'expires_at' => now()->addSeconds($remaining),
    ]);

    thPay004FakeSuccessfulProviderFlow();

    $this->postJson(
        kioskSessionRoute('kiosk.sessions.payments.store', $session),
    )->assertCreated();

    Http::assertSent(fn (HttpRequest $request): bool => $request->url() === 'https://api.paymongo.com/v1/payment_methods'
        && ($request->data()['data']['attributes']['expiry_seconds'] ?? null)
            === $expected
    );
})->with([
    'local session wins' => [120, 120],
    'PayMongo maximum wins' => [12000, 9000],
]);

test('less than sixty seconds rejects before provider creation', function () {
    Carbon::setTestNow('2026-08-28 10:00:00');

    $business = Business::factory()->create();
    thPay004ReadyAccount($business);

    $session = thPay004Session($business, [
        'expires_at' => now()->addSeconds(59),
    ]);

    $this->postJson(
        kioskSessionRoute('kiosk.sessions.payments.store', $session),
    )->assertStatus(409);

    expect(Payment::count())->toBe(0);

    Http::assertNothingSent();
});

test('duplicate pending payment is rejected before remote creation', function () {
    $business = Business::factory()->create();
    $account = thPay004ReadyAccount($business);
    $session = thPay004Session($business, [
        'status' => PhotoboothSessionStatus::PaymentPending,
    ]);

    Payment::factory()
        ->for($session, 'photoboothSession')
        ->payMongoQrPh($account)
        ->create();

    $this->postJson(
        kioskSessionRoute('kiosk.sessions.payments.store', $session),
    )->assertStatus(409);

    expect(Payment::count())->toBe(1);

    Http::assertNothingSent();
});

test('database enforces one pending attempt for a session', function () {
    $business = Business::factory()->create();
    $account = thPay004ReadyAccount($business);
    $session = thPay004Session($business);

    Payment::factory()
        ->for($session, 'photoboothSession')
        ->payMongoQrPh($account)
        ->create();

    expect(fn () => Payment::factory()
        ->for($session, 'photoboothSession')
        ->payMongoQrPh($account)
        ->create())
        ->toThrow(QueryException::class);
});

test('definitive provider failure terminalizes attempt for retry', function () {
    $business = Business::factory()->create();
    thPay004ReadyAccount($business);
    $session = thPay004Session($business);

    Http::fake([
        'https://api.paymongo.com/v1/payment_intents' => Http::response([], 422),
    ]);

    $this->postJson(
        kioskSessionRoute('kiosk.sessions.payments.store', $session),
    )->assertStatus(502);

    $payment = Payment::firstOrFail();

    expect($payment->status)->toBe(PaymentStatus::Failed)
        ->and($payment->provider_status)->toBe('creation_failed')
        ->and($payment->failed_at)->not->toBeNull();

    Http::assertSentCount(1);
});

test('exhausted transient failure remains reconcilable and blocks duplicates', function () {
    $business = Business::factory()->create();
    thPay004ReadyAccount($business);
    $session = thPay004Session($business);

    $attempts = 0;

    Http::fake(function (HttpRequest $request) use (&$attempts) {
        if ($request->url() === 'https://api.paymongo.com/v1/payment_intents') {
            $attempts++;

            return Http::response([], 503);
        }

        return Http::response([], 404);
    });

    $this->postJson(
        kioskSessionRoute('kiosk.sessions.payments.store', $session),
    )->assertStatus(503);

    $payment = Payment::firstOrFail();

    expect($attempts)->toBe(3)
        ->and($payment->status)->toBe(PaymentStatus::Pending)
        ->and($payment->provider_status)->toBe('provider_uncertain');

    $this->postJson(
        kioskSessionRoute('kiosk.sessions.payments.store', $session),
    )->assertStatus(409);

    expect(Payment::count())->toBe(1)
        ->and($attempts)->toBe(3);
});

test('retry preserves original session snapshots', function () {
    $business = Business::factory()->create();
    thPay004ReadyAccount($business);

    $session = thPay004Session($business, [
        'price' => '150.01',
        'currency' => 'PHP',
        'required_capture_count' => 4,
    ]);

    Http::fake([
        'https://api.paymongo.com/v1/payment_intents' => Http::response([], 422),
    ]);

    $this->postJson(
        kioskSessionRoute('kiosk.sessions.payments.store', $session),
    )->assertStatus(502);

    ApplicationSetting::updateOrCreate(
        ['key' => 'session_price'],
        ['value' => '999.99'],
    );

    ApplicationSetting::updateOrCreate(
        ['key' => 'currency'],
        ['value' => 'USD'],
    );

    config()->set('photobooth.capture_shot_count', 10);

    thPay004FakeSuccessfulProviderFlow(
        intentId: 'pi_retry',
        paymentMethodId: 'pm_retry',
        paymentId: 'pay_retry',
        clientKey: 'pi_retry_client_value',
    );

    $this->postJson(
        kioskSessionRoute('kiosk.sessions.payments.store', $session),
    )->assertCreated();

    $payments = Payment::orderBy('id')->get();
    $freshSession = $session->fresh();

    expect($payments)->toHaveCount(2)
        ->and($payments[0]->status)->toBe(PaymentStatus::Failed)
        ->and($payments[1]->amount)->toBe('150.01')
        ->and($payments[1]->currency)->toBe('PHP')
        ->and($freshSession->price)->toBe('150.01')
        ->and($freshSession->currency)->toBe('PHP')
        ->and($freshSession->required_capture_count)->toBe(4);
});

test('historical attempts remain auditable and latest attempt is exposed', function () {
    $business = Business::factory()->create();
    $account = thPay004ReadyAccount($business);
    $session = thPay004Session($business);

    $failed = Payment::factory()
        ->for($session, 'photoboothSession')
        ->create([
            'status' => PaymentStatus::Failed,
            'created_at' => now()->subMinute(),
        ]);

    $pending = Payment::factory()
        ->for($session, 'photoboothSession')
        ->payMongoQrPh($account)
        ->create();

    expect($session->payments()->count())->toBe(2)
        ->and($session->payment()->firstOrFail()->id)->toBe($pending->id)
        ->and($session->payments()->pluck('id')->all())
        ->toContain($failed->id, $pending->id);
});
