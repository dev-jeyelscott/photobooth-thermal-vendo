<?php

use App\Services\ColorCompositionService;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Encoders\PngEncoder;

function stickerAssetPng(): string
{
    $image = imagecreatetruecolor(50, 50);
    imagefill($image, 0, 0, imagecolorallocate($image, 10, 200, 30));
    ob_start();
    imagepng($image);
    imagedestroy($image);

    return ob_get_clean();
}

function baseTemplate(): array
{
    return [
        'layout_config' => null,
        'photo_slots' => 0,
        'print_width_mm' => 100,
        'print_height_mm' => 50,
    ];
}

test('overlaying a sticker with no placement data matches the hardcoded ratios', function () {
    Storage::fake('public');
    Storage::disk('public')->put('stickers/sticker.png', stickerAssetPng());

    $service = app(ColorCompositionService::class);

    $withoutPlacementKey = $service->compose(baseTemplate(), [], ['asset_path' => 'stickers/sticker.png']);
    $withNullPlacement = $service->compose(baseTemplate(), [], ['asset_path' => 'stickers/sticker.png', 'placement' => null]);

    expect((string) $withoutPlacementKey->encode(new PngEncoder))->toBe((string) $withNullPlacement->encode(new PngEncoder));
});

test('overlaying a sticker with placement data uses its size and margin ratios', function () {
    Storage::fake('public');
    Storage::disk('public')->put('stickers/sticker.png', stickerAssetPng());

    $service = app(ColorCompositionService::class);

    $default = $service->compose(baseTemplate(), [], ['asset_path' => 'stickers/sticker.png']);
    $custom = $service->compose(baseTemplate(), [], [
        'asset_path' => 'stickers/sticker.png',
        'placement' => ['size_ratio' => 0.5, 'margin_ratio' => 0.1],
    ]);

    expect((string) $default->encode(new PngEncoder))->not->toBe((string) $custom->encode(new PngEncoder));
});
