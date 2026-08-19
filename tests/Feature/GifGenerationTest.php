<?php

use App\Enums\PhotoboothSessionStatus;
use App\Models\CapturedMedia;
use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use Illuminate\Support\Facades\Storage;

function gifFixturePng(int $red): string
{
    $image = imagecreatetruecolor(200, 200);
    imagefill($image, 0, 0, imagecolorallocate($image, $red, 50, 50));
    ob_start();
    imagepng($image);
    imagedestroy($image);

    return ob_get_clean();
}

test('composing the final output persists an animated gif of the captured photo sequence', function () {
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
        'data:image/png;base64,'.base64_encode(gifFixturePng(200)),
        'data:image/png;base64,'.base64_encode(gifFixturePng(20)),
    ];

    $response = $this->postJson(route('kiosk.sessions.color-output.store', $session->session_token), [
        'photos' => $photos,
    ]);

    $response->assertOk();

    $capturedMedia = CapturedMedia::where('photobooth_session_id', $session->id)->first();

    expect($capturedMedia)->not->toBeNull()
        ->and($capturedMedia->gif_path)->not->toBeNull()
        ->and($capturedMedia->gif_path)->toEndWith('.gif');

    Storage::disk('public')->assertExists($capturedMedia->gif_path);

    $contents = Storage::disk('public')->get($capturedMedia->gif_path);

    expect(substr($contents, 0, 3))->toBe('GIF')
        ->and(strlen($contents))->toBeLessThanOrEqual(3 * 1024 * 1024);
});
