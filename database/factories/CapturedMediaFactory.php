<?php

namespace Database\Factories;

use App\Models\CapturedMedia;
use App\Models\PhotoboothSession;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CapturedMedia>
 */
class CapturedMediaFactory extends Factory
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
            'color_path' => 'captures/'.fake()->uuid().'-color.jpg',
            'bw_path' => 'captures/'.fake()->uuid().'-bw.jpg',
            'gif_path' => 'captures/'.fake()->uuid().'.gif',
            'expires_at' => now()->addDays(7),
        ];
    }
}
