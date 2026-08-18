<?php

namespace Database\Factories;

use App\Models\StickerDesign;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StickerDesign>
 */
class StickerDesignFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->sentence(2).' sticker',
            'asset_path' => 'stickers/'.fake()->uuid().'.png',
            'thumbnail_path' => 'stickers/thumbnails/'.fake()->uuid().'.png',
            'active' => true,
        ];
    }

    /**
     * Indicate that the sticker design is inactive.
     */
    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'active' => false,
        ]);
    }
}
