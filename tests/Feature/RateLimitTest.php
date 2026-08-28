<?php

use App\Enums\PayMongoMode;
use App\Models\Business;
use App\Models\PayMongoAccount;
use App\Models\PhotoboothSession;
use Illuminate\Support\Facades\Http;

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
        'services.paymongo.api_base_url' => 'https://api.paymongo.com',
    ]);

    $business = Business::factory()->create();

    $account = PayMongoAccount::factory()
        ->for($business)
        ->webhookProvisioned()
        ->create();

    $business->forceFill([
        'active_paymongo_mode' => PayMongoMode::Test,
        'test_paymongo_account_id' => $account->id,
    ])->save();

    Http::fakeSequence()
        ->push([
            'data' => [
                'id' => 'pi_rate_1',
                'attributes' => [
                    'client_key' => 'pi_rate_1_client',
                    'status' => 'awaiting_payment_method',
                    'payments' => [],
                ],
            ],
        ], 200)
        ->push([
            'data' => [
                'id' => 'pm_rate_1',
                'attributes' => [
                    'type' => 'qrph',
                ],
            ],
        ], 200)
        ->push([
            'data' => [
                'id' => 'pi_rate_1',
                'attributes' => [
                    'status' => 'awaiting_next_action',
                    'payments' => [
                        ['id' => 'pay_rate_1'],
                    ],
                    'next_action' => [
                        'code' => [
                            'image_url' => 'data:image/png;base64,cmF0ZS0x',
                        ],
                    ],
                ],
            ],
        ], 200)
        ->push([
            'data' => [
                'id' => 'pi_rate_2',
                'attributes' => [
                    'client_key' => 'pi_rate_2_client',
                    'status' => 'awaiting_payment_method',
                    'payments' => [],
                ],
            ],
        ], 200)
        ->push([
            'data' => [
                'id' => 'pm_rate_2',
                'attributes' => [
                    'type' => 'qrph',
                ],
            ],
        ], 200)
        ->push([
            'data' => [
                'id' => 'pi_rate_2',
                'attributes' => [
                    'status' => 'awaiting_next_action',
                    'payments' => [
                        ['id' => 'pay_rate_2'],
                    ],
                    'next_action' => [
                        'code' => [
                            'image_url' => 'data:image/png;base64,cmF0ZS0y',
                        ],
                    ],
                ],
            ],
        ], 200);

    $sessions = PhotoboothSession::factory()
        ->for($business)
        ->count(3)
        ->create([
            'price' => '150.00',
            'currency' => 'PHP',
            'expires_at' => now()->addMinutes(15),
        ]);

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

    Http::assertSentCount(6);
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
