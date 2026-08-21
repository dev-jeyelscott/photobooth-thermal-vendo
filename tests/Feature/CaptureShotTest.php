<?php

use App\Enums\PhotoboothSessionStatus;
use App\Models\PhotoboothSession;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\ImageManager;

test('an uploaded capture shot is persisted under the session captures directory', function () {
    Storage::fake('public');

    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::Capturing]);

    $shot = UploadedFile::fake()->image('shot.jpg', 800, 600);

    $response = $this->postJson(route('kiosk.sessions.shots.store', $session->session_token), [
        'shot' => $shot,
    ]);

    $response->assertOk();

    $path = $response->json('path');

    expect($path)->toStartWith('captures/'.$session->session_token.'/');
    Storage::disk('public')->assertExists($path);
});

test('an oversized captured shot is downscaled to the configured maximum dimension', function () {
    Storage::fake('public');
    config(['photobooth.captured_frame_max_dimension_px' => 500]);

    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::Capturing]);

    $shot = UploadedFile::fake()->image('shot.jpg', 3000, 2000);

    $response = $this->postJson(route('kiosk.sessions.shots.store', $session->session_token), [
        'shot' => $shot,
    ]);

    $response->assertOk();

    $stored = app(ImageManager::class)->decode(Storage::disk('public')->get($response->json('path')));

    expect(max($stored->width(), $stored->height()))->toBe(500)
        ->and($stored->width())->toBeLessThanOrEqual(500)
        ->and($stored->height())->toBeLessThanOrEqual(500);
});

test('a captured shot already within bounds is stored unmodified', function () {
    Storage::fake('public');
    config(['photobooth.captured_frame_max_dimension_px' => 2400]);

    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::Capturing]);

    $shot = UploadedFile::fake()->image('shot.jpg', 800, 600);
    $originalContents = file_get_contents($shot->getRealPath());

    $response = $this->postJson(route('kiosk.sessions.shots.store', $session->session_token), [
        'shot' => $shot,
    ]);

    $response->assertOk();

    expect(Storage::disk('public')->get($response->json('path')))->toBe($originalContents);
});

test('uploading a capture shot for an unknown session returns not found', function () {
    $shot = UploadedFile::fake()->image('shot.jpg', 800, 600);

    $response = $this->postJson(route('kiosk.sessions.shots.store', (string) Str::uuid()), [
        'shot' => $shot,
    ]);

    $response->assertNotFound();
});

test('uploading a non-image file as a capture shot is rejected', function () {
    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::Capturing]);

    $response = $this->postJson(route('kiosk.sessions.shots.store', $session->session_token), [
        'shot' => UploadedFile::fake()->create('shot.txt', 10, 'text/plain'),
    ]);

    $response->assertStatus(422);
    $response->assertJsonValidationErrors(['shot']);
});
