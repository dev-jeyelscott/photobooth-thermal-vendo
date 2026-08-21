<?php

use App\Enums\PhotoboothSessionStatus;
use App\Jobs\ProcessPrintJob;
use App\Models\CapturedMedia;
use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use App\Models\StickerDesign;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\ImageManager;

function imagecreatetruecolorPng(): string
{
    $image = imagecreatetruecolor(200, 200);
    imagefill($image, 0, 0, imagecolorallocate($image, 200, 50, 50));
    ob_start();
    imagepng($image);
    imagedestroy($image);

    return ob_get_clean();
}

test('composing the final color photo advances the session and persists the color path', function () {
    Storage::fake('public');
    Queue::fake([ProcessPrintJob::class]);

    $sticker = StickerDesign::factory()->create(['asset_path' => 'stickers/party-hat.png']);
    Storage::disk('public')->put($sticker->asset_path, imagecreatetruecolorPng());

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

    $photo = 'data:image/png;base64,'.base64_encode(imagecreatetruecolorPng());

    $response = $this->postJson(route('kiosk.sessions.color-output.store', $session->session_token), [
        'photos' => [$photo, $photo],
    ]);

    $response->assertStatus(202);
    $response->assertJson(['status' => PhotoboothSessionStatus::Printing->value]);

    $session->refresh();
    expect($session->status)->toBe(PhotoboothSessionStatus::Printing);

    $capturedMedia = CapturedMedia::where('photobooth_session_id', $session->id)->first();

    expect($capturedMedia)->not->toBeNull()
        ->and($capturedMedia->color_path)->not->toBeNull();

    Storage::disk('public')->assertExists($capturedMedia->color_path);

    $composite = app(ImageManager::class)->decode(Storage::disk('public')->get($capturedMedia->color_path));

    expect($composite->width())->toBeGreaterThan(0)
        ->and($composite->height())->toBeGreaterThan(0);
});

test('composing the final color photo accepts stored frame path references', function () {
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
        'status' => PhotoboothSessionStatus::Customizing,
        'photo_template_id' => $template->id,
    ]);

    $firstPath = 'captures/'.$session->session_token.'/1.png';
    $secondPath = 'captures/'.$session->session_token.'/2.png';
    Storage::disk('public')->put($firstPath, imagecreatetruecolorPng());
    Storage::disk('public')->put($secondPath, imagecreatetruecolorPng());

    $response = $this->postJson(route('kiosk.sessions.color-output.store', $session->session_token), [
        'photo_paths' => [$firstPath, $secondPath],
    ]);

    $response->assertStatus(202);

    $capturedMedia = CapturedMedia::where('photobooth_session_id', $session->id)->first();

    expect($capturedMedia)->not->toBeNull();
    Storage::disk('public')->assertExists($capturedMedia->color_path);
});

test('composing the final color photo rejects a stored frame path outside the session captures directory', function () {
    Storage::fake('public');

    $template = PhotoTemplate::factory()->create(['photo_slots' => 1]);
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Customizing,
        'photo_template_id' => $template->id,
    ]);
    $otherSession = PhotoboothSession::factory()->create();

    $foreignPath = 'captures/'.$otherSession->session_token.'/1.png';
    Storage::disk('public')->put($foreignPath, imagecreatetruecolorPng());

    $response = $this->postJson(route('kiosk.sessions.color-output.store', $session->session_token), [
        'photo_paths' => [$foreignPath],
    ]);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['photo_paths.0']);
});

test('composing the final color photo without enough confirmed photos is rejected', function () {
    Storage::fake('public');

    $template = PhotoTemplate::factory()->create(['photo_slots' => 2]);
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Customizing,
        'photo_template_id' => $template->id,
    ]);

    $photo = 'data:image/png;base64,'.base64_encode(imagecreatetruecolorPng());

    $response = $this->postJson(route('kiosk.sessions.color-output.store', $session->session_token), [
        'photos' => [$photo],
    ]);

    $response->assertStatus(422);

    expect($session->fresh()->status)->toBe(PhotoboothSessionStatus::Customizing);
    expect(CapturedMedia::where('photobooth_session_id', $session->id)->exists())->toBeFalse();
});

test('composing the final color photo before a template has been chosen is rejected', function () {
    Storage::fake('public');

    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Paid,
        'photo_template_id' => null,
    ]);

    $response = $this->postJson(route('kiosk.sessions.color-output.store', $session->session_token), [
        'photos' => ['data:image/png;base64,'.base64_encode(imagecreatetruecolorPng())],
    ]);

    $response->assertStatus(422);
});

test('composing the final color photo for an unknown session returns not found', function () {
    $response = $this->postJson(route('kiosk.sessions.color-output.store', (string) Str::uuid()), [
        'photos' => ['data:image/png;base64,'.base64_encode(imagecreatetruecolorPng())],
    ]);

    $response->assertNotFound();
});

test('composing the final color photo with a non-image payload is rejected', function () {
    $template = PhotoTemplate::factory()->create(['photo_slots' => 1]);
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Customizing,
        'photo_template_id' => $template->id,
    ]);

    $response = $this->postJson(route('kiosk.sessions.color-output.store', $session->session_token), [
        'photos' => ['not-an-image-payload'],
    ]);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['photos.0']);
});

test('composing the final color photo with an oversized photo is rejected', function () {
    config(['photobooth.captured_photo_max_kilobytes' => 0]);

    $template = PhotoTemplate::factory()->create(['photo_slots' => 1]);
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Customizing,
        'photo_template_id' => $template->id,
    ]);

    $photo = 'data:image/png;base64,'.base64_encode(imagecreatetruecolorPng());

    $response = $this->postJson(route('kiosk.sessions.color-output.store', $session->session_token), [
        'photos' => [$photo],
    ]);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['photos.0']);
});
