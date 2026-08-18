<?php

namespace Database\Factories;

use App\Models\PhotoTemplate;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PhotoTemplate>
 */
class PhotoTemplateFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->sentence(2).' template',
            'layout_path' => 'templates/'.fake()->uuid().'.png',
            'thumbnail_path' => 'templates/thumbnails/'.fake()->uuid().'.png',
            'photo_slots' => fake()->numberBetween(1, 4),
            'active' => true,
        ];
    }

    /**
     * Indicate that the template is inactive.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'active' => false,
        ]);
    }
}
