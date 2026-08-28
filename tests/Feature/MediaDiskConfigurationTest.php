<?php

use App\Models\CapturedMedia;
use App\Models\PhotoTemplate;
use App\Models\StickerDesign;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;

test('media disk defaults to public', function () {
    expect(config('filesystems.media'))->toBe('public');
});

test('gallery streams media from the configured disk', function () {
    config(['filesystems.media' => 's3']);
    Storage::fake('s3');

    $capturedMedia = CapturedMedia::factory()->create([
        'color_path' => 'captures/configured-disk.jpg',
        'expires_at' => now()->addDay(),
    ]);

    Storage::disk('s3')->put($capturedMedia->color_path, 'configured-disk-image');

    $this->get(route('gallery.media', [
        'capturedMedia' => $capturedMedia->public_token,
        'variant' => 'color',
    ]))
        ->assertOk()
        ->assertStreamedContent('configured-disk-image');
});

test('template and sticker uploads use the configured disk', function () {
    config(['filesystems.media' => 's3']);
    Storage::fake('s3');

    $user = User::factory()->create();
    $layoutConfig = json_encode([
        'slots' => [[
            'slot' => 1,
            'x' => 0,
            'y' => 0,
            'width' => 100,
            'height' => 150,
        ]],
    ], JSON_THROW_ON_ERROR);

    $this->actingAs($user)->post(route('admin.templates.store'), [
        'name' => 'S3 Template',
        'slug' => 's3-template',
        'orientation' => 'portrait',
        'layout' => UploadedFile::fake()->image('layout.png'),
        'photo_slots' => 1,
        'layout_config' => $layoutConfig,
        'print_width_mm' => 100,
        'print_height_mm' => 150,
    ])->assertRedirect(route('admin.templates.index'));

    $template = PhotoTemplate::sole();
    Storage::disk('s3')->assertExists($template->layout_path);

    $this->actingAs($user)->post(route('admin.stickers.store'), [
        'name' => 'S3 Sticker',
        'asset' => UploadedFile::fake()->image('asset.png'),
    ])->assertRedirect(route('admin.stickers.index'));

    $sticker = StickerDesign::sole();
    Storage::disk('s3')->assertExists($sticker->asset_path);
});

test('pruning deletes media from the configured disk', function () {
    config(['filesystems.media' => 's3']);
    Storage::fake('s3');

    $capturedMedia = CapturedMedia::factory()->create([
        'expires_at' => now()->subDay(),
    ]);

    Storage::disk('s3')->put($capturedMedia->color_path, 'color');
    Storage::disk('s3')->put($capturedMedia->bw_path, 'bw');
    Storage::disk('s3')->put($capturedMedia->gif_path, 'gif');

    Artisan::call('media:prune-expired');

    Storage::disk('s3')->assertMissing([
        $capturedMedia->color_path,
        $capturedMedia->bw_path,
        $capturedMedia->gif_path,
    ]);
});
