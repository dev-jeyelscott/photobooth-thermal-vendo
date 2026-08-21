<?php

namespace Database\Factories;

use App\Models\PhotoTemplate;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

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
        $photoSlots = fake()->numberBetween(1, 4);
        $name = fake()->sentence(2).' template';

        return [
            'name' => $name,
            'slug' => Str::slug($name).'-'.fake()->unique()->numberBetween(1, 1_000_000),
            'orientation' => fake()->randomElement(['portrait', 'landscape']),
            'layout_path' => 'templates/'.fake()->uuid().'.png',
            'thumbnail_path' => 'templates/thumbnails/'.fake()->uuid().'.png',
            'photo_slots' => $photoSlots,
            'layout_config' => [
                'slots' => collect(range(1, $photoSlots))->map(fn (int $slot) => [
                    'slot' => $slot,
                    'x' => 0,
                    'y' => ($slot - 1) * 100,
                    'width' => 100,
                    'height' => 100,
                ])->all(),
            ],
            'print_width_mm' => 100,
            'print_height_mm' => 150,
            'active' => true,
            'sort_order' => 0,
            'printer_compatibility' => null,
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
