<?php

use App\Enums\PhotoboothSessionStatus;
use App\Enums\PrintJobStatus;
use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use App\Models\PrintJob;
use Illuminate\Support\Facades\Storage;

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
});
