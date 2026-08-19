<?php

use App\Enums\PhotoboothSessionStatus;
use App\Models\CapturedMedia;
use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use App\Models\StickerDesign;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\ImageManager;

function bwFixturePng(): string
{
    $image = imagecreatetruecolor(200, 200);
    imagefill($image, 0, 0, imagecolorallocate($image, 200, 50, 50));
    ob_start();
    imagepng($image);
    imagedestroy($image);

    return ob_get_clean();
}

test('composing the final output persists a distinct grayscale version alongside the color version', function () {
    Storage::fake('public');

    $sticker = StickerDesign::factory()->create(['asset_path' => 'stickers/party-hat.png']);
    Storage::disk('public')->put($sticker->asset_path, bwFixturePng());

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
        'sticker_design_id' => $sticker->id,
    ]);

    $photo = 'data:image/png;base64,'.base64_encode(bwFixturePng());

    $response = $this->postJson(route('kiosk.sessions.color-output.store', $session->session_token), [
        'photos' => [$photo, $photo],
    ]);

    $response->assertOk();

    $capturedMedia = CapturedMedia::where('photobooth_session_id', $session->id)->first();

    expect($capturedMedia)->not->toBeNull()
        ->and($capturedMedia->color_path)->not->toBeNull()
        ->and($capturedMedia->bw_path)->not->toBeNull()
        ->and($capturedMedia->bw_path)->not->toBe($capturedMedia->color_path);

    Storage::disk('public')->assertExists($capturedMedia->color_path);
    Storage::disk('public')->assertExists($capturedMedia->bw_path);

    $colorComposite = app(ImageManager::class)->decode(Storage::disk('public')->get($capturedMedia->color_path));
    $bwComposite = app(ImageManager::class)->decode(Storage::disk('public')->get($capturedMedia->bw_path));

    expect($bwComposite->width())->toBe($colorComposite->width())
        ->and($bwComposite->height())->toBe($colorComposite->height());

    foreach ([[0, 0], [$bwComposite->width() - 1, $bwComposite->height() - 1]] as [$x, $y]) {
        expect($bwComposite->colorAt($x, $y)->isGrayscale())->toBeTrue();
    }
});

test('composing the final output for an unknown session returns not found', function () {
    $response = $this->postJson(route('kiosk.sessions.color-output.store', (string) Str::uuid()), [
        'photos' => ['data:image/png;base64,'.base64_encode(bwFixturePng())],
    ]);

    $response->assertNotFound();
});
