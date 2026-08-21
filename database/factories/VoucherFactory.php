<?php

namespace Database\Factories;

use App\Models\Voucher;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Voucher>
 */
class VoucherFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'code' => strtoupper(fake()->unique()->bothify('VCH-????-####')),
            'active' => true,
            'valid_from' => null,
            'expires_at' => now()->addMonth(),
            'usage_limit' => 1,
            'usage_count' => 0,
        ];
    }

    /**
     * Indicate that the voucher is expired.
     */
    public function expired(): static
    {
        return $this->state(fn (array $attributes) => [
            'expires_at' => now()->subDay(),
        ]);
    }

    /**
     * Indicate that the voucher has been fully redeemed.
     */
    public function exhausted(): static
    {
        return $this->state(fn (array $attributes) => [
            'usage_count' => $attributes['usage_limit'] ?? 1,
        ]);
    }

    /**
     * Indicate that the voucher is inactive.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'active' => false,
        ]);
    }
}
