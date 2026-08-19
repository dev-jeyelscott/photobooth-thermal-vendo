<?php

use App\Enums\PhotoboothSessionStatus;
use App\Models\CapturedMedia;
use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

function mediaExpirationPng(): string
{
    $image = imagecreatetruecolor(100, 100);
    imagefill($image, 0, 0, imagecolorallocate($image, 50, 100, 150));
    ob_start();
    imagepng($image);
    imagedestroy($image);

    return ob_get_clean();
}

test('composing the final color photo sets expires_at based on the configured gallery expiration', function () {
    Storage::fake('public');
    config(['photobooth.gallery_expiration_hours' => 48]);

    $template = PhotoTemplate::factory()->create([
        'photo_slots' => 1,
        'layout_config' => [
            'slots' => [
                ['slot' => 1, 'x' => 0, 'y' => 0, 'width' => 100, 'height' => 100],
            ],
        ],
        'print_width_mm' => 100,
        'print_height_mm' => 50,
    ]);

    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Customizing,
        'photo_template_id' => $template->id,
        'sticker_design_id' => null,
    ]);

    $photo = 'data:image/png;base64,'.base64_encode(mediaExpirationPng());

    $response = $this->postJson(route('kiosk.sessions.color-output.store', $session->session_token), [
        'photos' => [$photo],
    ]);

    $response->assertOk();

    $capturedMedia = CapturedMedia::where('photobooth_session_id', $session->id)->first();

    expect($capturedMedia->expires_at)->not->toBeNull();
    expect($capturedMedia->expires_at->diffInHours(now()->addHours(48)))->toBeLessThan(1);
});

test('pruning expired media deletes only expired captured media files and records', function () {
    Storage::fake('public');

    $expired = CapturedMedia::factory()->create([
        'color_path' => 'captures/expired-color.jpg',
        'bw_path' => 'captures/expired-bw.jpg',
        'gif_path' => 'captures/expired-animation.gif',
        'expires_at' => now()->subDay(),
    ]);
    Storage::disk('public')->put($expired->color_path, 'color');
    Storage::disk('public')->put($expired->bw_path, 'bw');
    Storage::disk('public')->put($expired->gif_path, 'gif');

    $active = CapturedMedia::factory()->create([
        'color_path' => 'captures/active-color.jpg',
        'bw_path' => 'captures/active-bw.jpg',
        'gif_path' => 'captures/active-animation.gif',
        'expires_at' => now()->addDay(),
    ]);
    Storage::disk('public')->put($active->color_path, 'color');
    Storage::disk('public')->put($active->bw_path, 'bw');
    Storage::disk('public')->put($active->gif_path, 'gif');

    $noExpiry = CapturedMedia::factory()->create([
        'color_path' => 'captures/no-expiry-color.jpg',
        'expires_at' => null,
    ]);
    Storage::disk('public')->put($noExpiry->color_path, 'color');

    $this->artisan('media:prune-expired')->assertSuccessful();

    expect(CapturedMedia::find($expired->id))->toBeNull();
    Storage::disk('public')->assertMissing($expired->color_path);
    Storage::disk('public')->assertMissing($expired->bw_path);
    Storage::disk('public')->assertMissing($expired->gif_path);

    expect(CapturedMedia::find($active->id))->not->toBeNull();
    Storage::disk('public')->assertExists($active->color_path);

    expect(CapturedMedia::find($noExpiry->id))->not->toBeNull();
    Storage::disk('public')->assertExists($noExpiry->color_path);
});

test('pruning expired media does not throw when the underlying file is already missing', function () {
    Storage::fake('public');

    $expired = CapturedMedia::factory()->create([
        'color_path' => 'captures/already-gone.jpg',
        'expires_at' => now()->subDay(),
    ]);

    $this->artisan('media:prune-expired')->assertSuccessful();

    expect(CapturedMedia::find($expired->id))->toBeNull();
});

test('an expired gallery token returns an expired-state response', function () {
    Storage::fake('public');

    $capturedMedia = CapturedMedia::factory()->create([
        'expires_at' => now()->subMinute(),
    ]);

    $response = $this->get(route('gallery.show', $capturedMedia->public_token));

    $response->assertOk();
    $response->assertInertia(fn (Assert $page) => $page
        ->component('gallery')
        ->where('expired', true)
        ->where('colorUrl', null)
        ->where('bwUrl', null)
        ->where('gifUrl', null)
    );
});
