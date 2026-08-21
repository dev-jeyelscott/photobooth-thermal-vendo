<?php

use App\Actions\Printing\CreatePrintJob;
use App\Enums\PhotoboothSessionStatus;
use App\Enums\PrintJobStatus;
use App\Jobs\ProcessPrintJob;
use App\Models\CapturedMedia;
use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use App\Models\PrintJob;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

function printJobFixturePng(int $red): string
{
    $image = imagecreatetruecolor(200, 200);
    imagefill($image, 0, 0, imagecolorallocate($image, $red, 50, 50));
    ob_start();
    imagepng($image);
    imagedestroy($image);

    return ob_get_clean();
}

test('composing the final output creates a pending print job for the session', function () {
    Storage::fake('public');
    Queue::fake();

    $template = PhotoTemplate::factory()->create([
        'photo_slots' => 2,
        'layout_config' => [
            'slots' => [
                ['slot' => 1, 'x' => 0, 'y' => 0, 'width' => 50, 'height' => 50],
                ['slot' => 2, 'x' => 50, 'y' => 0, 'width' => 50, 'height' => 50],
            ],
        ],
        'print_width_mm' => 100,
        'print_height_mm' => 50,
    ]);

    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Customizing,
        'photo_template_id' => $template->id,
    ]);

    $photos = [
        'data:image/png;base64,'.base64_encode(printJobFixturePng(200)),
        'data:image/png;base64,'.base64_encode(printJobFixturePng(20)),
    ];

    $response = $this->postJson(route('kiosk.sessions.color-output.store', $session->session_token), [
        'photos' => $photos,
    ]);

    $response->assertOk();

    $printJob = PrintJob::where('photobooth_session_id', $session->id)->first();

    expect($printJob)->not->toBeNull()
        ->and($printJob->status)->toBe(PrintJobStatus::Pending)
        ->and($printJob->photobooth_session_id)->toBe($session->id);

    Queue::assertPushed(ProcessPrintJob::class, fn (ProcessPrintJob $job): bool => $job->printJob->is($printJob));
});

test('a failure while creating the print job rolls back the session transition and captured media', function () {
    Storage::fake('public');
    Queue::fake();

    $this->app->bind(CreatePrintJob::class, function (): CreatePrintJob {
        return new class extends CreatePrintJob
        {
            public function handle(PhotoboothSession $session): PrintJob
            {
                throw new RuntimeException('Simulated print job creation failure.');
            }
        };
    });

    $template = PhotoTemplate::factory()->create([
        'photo_slots' => 2,
        'layout_config' => [
            'slots' => [
                ['slot' => 1, 'x' => 0, 'y' => 0, 'width' => 50, 'height' => 50],
                ['slot' => 2, 'x' => 50, 'y' => 0, 'width' => 50, 'height' => 50],
            ],
        ],
        'print_width_mm' => 100,
        'print_height_mm' => 50,
    ]);

    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Customizing,
        'photo_template_id' => $template->id,
    ]);

    $photos = [
        'data:image/png;base64,'.base64_encode(printJobFixturePng(200)),
        'data:image/png;base64,'.base64_encode(printJobFixturePng(20)),
    ];

    $response = $this->postJson(route('kiosk.sessions.color-output.store', $session->session_token), [
        'photos' => $photos,
    ]);

    $response->assertStatus(500);

    expect($session->fresh()->status)->toBe(PhotoboothSessionStatus::Customizing)
        ->and(PrintJob::where('photobooth_session_id', $session->id)->exists())->toBeFalse()
        ->and(CapturedMedia::where('photobooth_session_id', $session->id)->exists())->toBeFalse();

    Queue::assertNotPushed(ProcessPrintJob::class);
});
