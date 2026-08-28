<?php

use App\Enums\PaymentMethod;
use App\Enums\PayMongoMode;
use App\Models\Business;
use App\Models\Payment;
use App\Models\PayMongoAccount;
use App\Models\PhotoboothSession;
use Illuminate\Support\Facades\Http;

test('payment creation returns the native PayMongo QR Ph image without wrapping a checkout URL', function () {
    config()->set('services.paymongo.api_base_url', 'https://api.paymongo.com');

    $business = Business::factory()->create();

    $account = PayMongoAccount::factory()
        ->for($business)
        ->webhookProvisioned()
        ->create();

    $business->forceFill([
        'active_paymongo_mode' => PayMongoMode::Test,
        'test_paymongo_account_id' => $account->id,
    ])->save();

    $session = PhotoboothSession::factory()
        ->for($business)
        ->create([
            'price' => '150.00',
            'currency' => 'PHP',
            'expires_at' => now()->addMinutes(15),
        ]);

    $qrImageUrl = 'data:image/png;base64,cGF5bW9uZ28tcXJwaA==';

    Http::fake([
        'https://api.paymongo.com/v1/payment_intents' => Http::response([
            'data' => [
                'id' => 'pi_qr_123',
                'attributes' => [
                    'client_key' => 'pi_qr_123_client_key',
                    'status' => 'awaiting_payment_method',
                    'payments' => [],
                ],
            ],
        ], 200),

        'https://api.paymongo.com/v1/payment_methods' => Http::response([
            'data' => [
                'id' => 'pm_qr_123',
                'attributes' => [
                    'type' => 'qrph',
                ],
            ],
        ], 200),

        'https://api.paymongo.com/v1/payment_intents/pi_qr_123/attach' => Http::response([
            'data' => [
                'id' => 'pi_qr_123',
                'attributes' => [
                    'status' => 'awaiting_next_action',
                    'payments' => [
                        ['id' => 'pay_qr_123'],
                    ],
                    'next_action' => [
                        'code' => [
                            'image_url' => $qrImageUrl,
                        ],
                    ],
                ],
            ],
        ], 200),
    ]);

    $response = $this->postJson(
        kioskSessionRoute(
            'kiosk.sessions.payments.store',
            $session,
        ),
    );

    $response
        ->assertCreated()
        ->assertJsonPath('payment.amount', '150.00')
        ->assertJsonPath('payment.currency', 'PHP')
        ->assertJsonPath('payment.providerStatus', 'awaiting_next_action')
        ->assertJsonPath('qrImageUrl', $qrImageUrl);

    $payload = $response->json();
    $payment = Payment::firstOrFail();

    expect($payload)->toBeArray()
        ->and(array_key_exists('checkoutUrl', $payload))->toBeFalse()
        ->and(array_key_exists('checkoutQrCode', $payload))->toBeFalse()
        ->and($payment->method)->toBe(PaymentMethod::PayMongoQrPh)
        ->and($payment->paymongo_payment_intent_id)->toBe('pi_qr_123')
        ->and($payment->paymongo_payment_method_id)->toBe('pm_qr_123')
        ->and($payment->paymongo_payment_id)->toBe('pay_qr_123');

    Http::assertSentCount(3);
});
