<?php

namespace Database\Factories;

use App\Models\Business;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Business>
 */
class BusinessFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->unique()->company();
        $baseSlug = Str::slug($name);

        return [
            'name' => $name,
            'slug' => ($baseSlug !== '' ? $baseSlug : 'business')
                .'-'
                .Str::lower(Str::random(8)),
            'owner_user_id' => User::factory(),
        ];
    }

    /**
     * Keep the generated owner assigned to the Business it owns.
     */
    public function configure(): static
    {
        return $this->afterCreating(function (Business $business): void {
            $business->owner
                ->forceFill(['business_id' => $business->id])
                ->save();
        });
    }
}
