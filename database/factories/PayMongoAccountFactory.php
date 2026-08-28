<?php

namespace Database\Factories;

use App\Enums\PayMongoMode;
use App\Models\Business;
use App\Models\PayMongoAccount;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<PayMongoAccount>
 */
class PayMongoAccountFactory extends Factory
{
    protected $model = PayMongoAccount::class;

    /**
     * Define a Test-mode PayMongo credential version.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $publicKey = 'pk_test_'.Str::random(32);
        $secretKey = 'sk_test_'.Str::random(32);

        return [
            'business_id' => Business::factory(),
            'mode' => PayMongoMode::Test,
            'public_key' => $publicKey,
            'secret_key' => $secretKey,
            'public_key_last4' => substr($publicKey, -4),
            'secret_key_last4' => substr($secretKey, -4),
            'webhook_id' => null,
            'webhook_secret' => null,
            'webhook_status' => null,
            'verified_at' => null,
            'webhook_provisioned_at' => null,
            'superseded_at' => null,
            'created_by_user_id' => null,
        ];
    }

    /**
     * Configure the credential version for PayMongo Live mode.
     */
    public function live(): static
    {
        return $this->state(function (array $attributes): array {
            $publicKey = 'pk_live_'.Str::random(32);
            $secretKey = 'sk_live_'.Str::random(32);

            return [
                'mode' => PayMongoMode::Live,
                'public_key' => $publicKey,
                'secret_key' => $secretKey,
                'public_key_last4' => substr($publicKey, -4),
                'secret_key_last4' => substr($secretKey, -4),
            ];
        });
    }

    /**
     * Mark the credential version as successfully verified.
     */
    public function verified(): static
    {
        return $this->state(fn (array $attributes): array => [
            'verified_at' => now(),
        ]);
    }

    /**
     * Mark the credential version as verified with an enabled webhook.
     */
    public function webhookProvisioned(): static
    {
        return $this->state(fn (array $attributes): array => [
            'verified_at' => now(),
            'webhook_id' => 'hook_'.Str::random(24),
            'webhook_secret' => 'whsk_'.Str::random(32),
            'webhook_status' => 'enabled',
            'webhook_provisioned_at' => now(),
        ]);
    }
}
