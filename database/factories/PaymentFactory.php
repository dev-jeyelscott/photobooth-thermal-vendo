<?php

namespace Database\Factories;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Models\Payment;
use App\Models\PhotoboothSession;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Payment>
 */
class PaymentFactory extends Factory
{
    /**
     * Define the model's default state.
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
            'amount' => fake()->randomFloat(2, 20, 150),
        ];
    }

    /**
     * Indicate that the payment succeeded.
     */
    public function success(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => PaymentStatus::Success,
            'maya_payment_id' => fake()->uuid(),
            'maya_checkout_id' => fake()->uuid(),
        ]);
    }
}
