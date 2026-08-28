<?php

namespace Database\Factories;

use App\Models\PayMongoAccount;
use App\Models\PayMongoWebhookEvent;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<PayMongoWebhookEvent>
 */
class PayMongoWebhookEventFactory extends Factory
{
    protected $model = PayMongoWebhookEvent::class;

    /**
     * Define a durable Test-mode PayMongo webhook inbox record.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $payload = [
            'data' => [
                'id' => 'evt_'.Str::random(24),
                'type' => 'event',
                'attributes' => [
                    'type' => 'payment.paid',
                    'livemode' => false,
                    'data' => [
                        'id' => 'pay_'.Str::random(24),
                        'type' => 'payment',
                        'attributes' => [
                            'amount' => 15000,
                            'currency' => 'PHP',
                            'status' => 'paid',
                            'livemode' => false,
                            'payment_intent_id' => 'pi_'.Str::random(24),
                        ],
                    ],
                ],
            ],
        ];

        $encodedPayload = json_encode(
            $payload,
            JSON_THROW_ON_ERROR,
        );

        return [
            'paymongo_account_id' => PayMongoAccount::factory()
                ->webhookProvisioned(),
            'provider_event_id' => $payload['data']['id'],
            'event_type' => 'payment.paid',
            'livemode' => false,
            'payload' => $payload,
            'payload_sha256' => hash(
                'sha256',
                $encodedPayload,
            ),
            'received_at' => now(),
            'processed_at' => null,
            'failed_at' => null,
            'last_error' => null,
        ];
    }
}
