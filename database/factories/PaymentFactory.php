<?php

namespace Database\Factories;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Models\Payment;
use App\Models\PayMongoAccount;
use App\Models\PhotoboothSession;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Payment>
 */
class PaymentFactory extends Factory
{
    /**
     * Define the legacy-compatible default payment state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'photobooth_session_id' => PhotoboothSession::factory(),
            'method' => PaymentMethod::Maya,
            'status' => PaymentStatus::Pending,
            'maya_payment_id' => null,
            'maya_checkout_id' => null,
            'amount' => fake()->randomElement([
                '20.00',
                '50.00',
                '100.00',
                '150.00',
            ]),
        ];
    }

    /**
     * Configure a pending PayMongo QR Ph attempt under an exact account version.
     */
    public function payMongoQrPh(PayMongoAccount $account): static
    {
        return $this->state(fn (array $attributes): array => [
            'paymongo_account_id' => $account->id,
            'method' => PaymentMethod::PayMongoQrPh,
            'status' => PaymentStatus::Pending,
            'maya_payment_id' => null,
            'maya_checkout_id' => null,
            'currency' => 'PHP',
            'provider_idempotency_key' => 'thermasnap-payment-'.Str::uuid(),
            'provider_status' => 'local_pending',
            'provider_expires_at' => now()->addMinutes(15),
        ]);
    }

    /**
     * Indicate that the legacy-compatible payment succeeded.
     */
    public function success(): static
    {
        return $this->state(fn (array $attributes): array => [
            'status' => PaymentStatus::Success,
            'maya_payment_id' => fake()->uuid(),
            'maya_checkout_id' => fake()->uuid(),
        ]);
    }
}
