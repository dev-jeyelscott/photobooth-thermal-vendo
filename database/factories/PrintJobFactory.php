<?php

namespace Database\Factories;

use App\Enums\PrintJobStatus;
use App\Models\PhotoboothSession;
use App\Models\PrintJob;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PrintJob>
 */
class PrintJobFactory extends Factory
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
            'status' => PrintJobStatus::Pending,
            'attempt_count' => 0,
            'last_error' => null,
            'started_at' => null,
            'completed_at' => null,
        ];
    }

    /**
     * Indicate that the print job failed.
     */
    public function failed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => PrintJobStatus::Failed,
            'attempt_count' => 3,
            'last_error' => 'Printer offline',
        ]);
    }

    /**
     * Indicate that the print job completed successfully.
     */
    public function printed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => PrintJobStatus::Printed,
            'attempt_count' => 1,
            'completed_at' => now(),
        ]);
    }
}
