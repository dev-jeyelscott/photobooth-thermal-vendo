<?php

namespace Database\Factories;

use App\Enums\PhotoboothSessionStatus;
use App\Models\Business;
use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<PhotoboothSession>
 */
class PhotoboothSessionFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'business_id' => Business::factory(),
            'session_token' => (string) Str::uuid(),
            'status' => PhotoboothSessionStatus::New,
            'photo_template_id' => PhotoTemplate::factory(),
            'sticker_design_id' => null,
            'voucher_id' => null,
            'started_at' => now(),
            'expires_at' => now()->addMinutes(15),
        ];
    }

    /**
     * Indicate that the session has expired.
     */
    public function expired(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => PhotoboothSessionStatus::Expired,
            'expires_at' => now()->subMinute(),
        ]);
    }
}
