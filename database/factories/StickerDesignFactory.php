<?php

namespace Database\Factories;

use App\Models\PhotoTemplate;
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
            'sort_order' => 0,
            'placement' => [
                'size_ratio' => 0.22,
                'margin_ratio' => 0.03,
            ],
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

    /**
     * Indicate that the sticker design has no placement metadata, falling
     * back to the composition service's hardcoded ratios.
     */
    public function withoutPlacement(): static
    {
        return $this->state(fn (array $attributes) => [
            'placement' => null,
        ]);
    }

    /**
     * Attach the sticker design to the given compatible photo templates
     * once created.
     */
    public function compatibleWith(PhotoTemplate ...$templates): static
    {
        return $this->afterCreating(function (StickerDesign $sticker) use ($templates) {
            $sticker->photoTemplates()->attach(collect($templates)->pluck('id'));
        });
    }
}
