<?php

use App\Enums\PhotoboothSessionStatus;
use App\Jobs\ProcessPrintJob;
use App\Models\CapturedMedia;
use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use App\Models\StickerDesign;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\ImageManager;

function composeColorPhotoTestPng(): string
{
    $image = imagecreatetruecolor(200, 200);
    imagefill($image, 0, 0, imagecolorallocate($image, 200, 50, 50));
    ob_start();
    imagepng($image);
    imagedestroy($image);

    return ob_get_clean();
}

test('composing the final color photo uses the template snapshot taken at selection, not a later edit', function () {
    Storage::fake('public');
    Queue::fake([ProcessPrintJob::class]);

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
        'status' => PhotoboothSessionStatus::Paid,
        'photo_template_id' => null,
    ]);

    $this->postJson(route('kiosk.sessions.template.store', $session->session_token), [
        'photoTemplateId' => $template->id,
    ])->assertOk();

    $template->update([
        'layout_config' => [
            'slots' => [
                ['slot' => 1, 'x' => 0, 'y' => 0, 'width' => 1000, 'height' => 1000],
            ],
        ],
        'photo_slots' => 1,
        'print_width_mm' => 5,
        'print_height_mm' => 5,
    ]);

    $photo = 'data:image/png;base64,'.base64_encode(composeColorPhotoTestPng());

    $response = $this->postJson(route('kiosk.sessions.color-output.store', $session->session_token), [
        'photos' => [$photo, $photo],
    ]);

    $response->assertStatus(202);

    $capturedMedia = CapturedMedia::where('photobooth_session_id', $session->id)->first();

    $composite = app(ImageManager::class)->decode(Storage::disk('public')->get($capturedMedia->color_path));

    $expectedWidthPixels = (int) round(100 / 25.4 * 300);
    $expectedHeightPixels = (int) round(50 / 25.4 * 300);

    expect($composite->width())->toBe($expectedWidthPixels)
        ->and($composite->height())->toBe($expectedHeightPixels);
});

test('composing the final color photo uses the sticker placement snapshot taken at selection, not a later edit', function () {
    Storage::fake('public');
    Queue::fake([ProcessPrintJob::class]);

    $sticker = StickerDesign::factory()->create([
        'asset_path' => 'stickers/party-hat.png',
        'placement' => ['size_ratio' => 0.1, 'margin_ratio' => 0.02],
    ]);

    $greenPng = function (): string {
        $image = imagecreatetruecolor(50, 50);
        imagefill($image, 0, 0, imagecolorallocate($image, 0, 255, 0));
        ob_start();
        imagepng($image);
        imagedestroy($image);

        return ob_get_clean();
    };
    Storage::disk('public')->put($sticker->asset_path, $greenPng());

    $template = PhotoTemplate::factory()->create([
        'photo_slots' => 1,
        'layout_config' => [
            'slots' => [
                ['slot' => 1, 'x' => 0, 'y' => 0, 'width' => 30, 'height' => 30],
            ],
        ],
        'print_width_mm' => 100,
        'print_height_mm' => 100,
    ]);

    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Paid,
        'photo_template_id' => null,
    ]);

    $this->postJson(route('kiosk.sessions.template.store', $session->session_token), [
        'photoTemplateId' => $template->id,
    ])->assertOk();

    $this->postJson(route('kiosk.sessions.sticker.store', $session->session_token), [
        'stickerDesignId' => $sticker->id,
    ])->assertOk();

    $sticker->update(['placement' => ['size_ratio' => 0.5, 'margin_ratio' => 0.02]]);

    $photo = 'data:image/png;base64,'.base64_encode(composeColorPhotoTestPng());

    $response = $this->postJson(route('kiosk.sessions.color-output.store', $session->session_token), [
        'photos' => [$photo],
    ]);

    $response->assertStatus(202);

    $capturedMedia = CapturedMedia::where('photobooth_session_id', $session->id)->first();

    $composite = app(ImageManager::class)->decode(Storage::disk('public')->get($capturedMedia->color_path));

    // With the original (small) placement snapshot, the sticker overlay does
    // not reach this point; with the mutated (large) placement it would.
    expect($composite->colorAt(600, 600)->toHex())->not->toBe('#00ff00');
});

test('re-submitting composition after a session has already advanced past Processing is rejected and does not create a duplicate CapturedMedia row or a second print job', function () {
    Storage::fake('public');
    Queue::fake([ProcessPrintJob::class]);

    $template = PhotoTemplate::factory()->create([
        'photo_slots' => 1,
        'layout_config' => [
            'slots' => [
                ['slot' => 1, 'x' => 0, 'y' => 0, 'width' => 50, 'height' => 50],
            ],
        ],
        'print_width_mm' => 100,
        'print_height_mm' => 50,
    ]);

    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Paid,
        'photo_template_id' => null,
    ]);

    $this->postJson(route('kiosk.sessions.template.store', $session->session_token), [
        'photoTemplateId' => $template->id,
    ])->assertOk();

    $photo = 'data:image/png;base64,'.base64_encode(composeColorPhotoTestPng());

    $this->postJson(route('kiosk.sessions.color-output.store', $session->session_token), [
        'photos' => [$photo],
    ])->assertStatus(202);

    expect($session->fresh()->status)->toBe(PhotoboothSessionStatus::Printing);

    $this->postJson(route('kiosk.sessions.color-output.store', $session->session_token), [
        'photos' => [$photo],
    ])->assertStatus(422);

    expect(CapturedMedia::where('photobooth_session_id', $session->id)->count())->toBe(1);

    Queue::assertPushed(ProcessPrintJob::class, 1);
});

test('re-running composition while a session is still Processing overwrites the same CapturedMedia row instead of creating a duplicate', function () {
    Storage::fake('public');
    Queue::fake([ProcessPrintJob::class]);

    $template = PhotoTemplate::factory()->create([
        'photo_slots' => 1,
        'layout_config' => [
            'slots' => [
                ['slot' => 1, 'x' => 0, 'y' => 0, 'width' => 50, 'height' => 50],
            ],
        ],
        'print_width_mm' => 100,
        'print_height_mm' => 50,
    ]);

    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Processing,
        'photo_template_id' => $template->id,
    ]);

    $photo = 'data:image/png;base64,'.base64_encode(composeColorPhotoTestPng());

    $this->postJson(route('kiosk.sessions.color-output.store', $session->session_token), [
        'photos' => [$photo],
    ])->assertStatus(202);

    $firstCapturedMedia = CapturedMedia::where('photobooth_session_id', $session->id)->firstOrFail();

    $session->refresh()->update(['status' => PhotoboothSessionStatus::Processing]);

    $this->postJson(route('kiosk.sessions.color-output.store', $session->session_token), [
        'photos' => [$photo],
    ])->assertStatus(202);

    expect(CapturedMedia::where('photobooth_session_id', $session->id)->count())->toBe(1)
        ->and(CapturedMedia::where('photobooth_session_id', $session->id)->first()->id)->toBe($firstCapturedMedia->id);

    Queue::assertPushed(ProcessPrintJob::class, 1);
});
