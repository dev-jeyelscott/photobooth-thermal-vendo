<?php

use App\Services\ColorCompositionService;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Interfaces\ImageInterface;

/**
 * Create a solid-color PNG fixture.
 */
function templateFrameSolidPng(
    int $red,
    int $green,
    int $blue,
    int $width = 40,
    int $height = 40,
): string {
    $image = imagecreatetruecolor($width, $height);

    imagefill(
        $image,
        0,
        0,
        imagecolorallocate(
            $image,
            $red,
            $green,
            $blue,
        ),
    );

    ob_start();
    imagepng($image);
    imagedestroy($image);

    return ob_get_clean();
}

/**
 * Create a blue frame with a truly transparent central photo opening.
 */
function transparentPhotoFramePng(): string
{
    $image = imagecreatetruecolor(40, 40);

    imagealphablending($image, false);
    imagesavealpha($image, true);

    $transparent = imagecolorallocatealpha(
        $image,
        255,
        255,
        255,
        127,
    );

    imagefill($image, 0, 0, $transparent);

    $blue = imagecolorallocatealpha(
        $image,
        0,
        0,
        255,
        0,
    );

    imagefilledrectangle($image, 0, 0, 39, 5, $blue);
    imagefilledrectangle($image, 0, 34, 39, 39, $blue);
    imagefilledrectangle($image, 0, 0, 5, 39, $blue);
    imagefilledrectangle($image, 34, 0, 39, 39, $blue);

    ob_start();
    imagepng($image);
    imagedestroy($image);

    return ob_get_clean();
}

/**
 * Create an opaque two-color frame used to prove exact full-canvas scaling.
 */
function twoColorTemplateFramePng(): string
{
    $image = imagecreatetruecolor(40, 20);

    $blue = imagecolorallocate($image, 0, 0, 255);
    $yellow = imagecolorallocate($image, 255, 255, 0);

    imagefilledrectangle($image, 0, 0, 19, 19, $blue);
    imagefilledrectangle($image, 20, 0, 39, 19, $yellow);

    ob_start();
    imagepng($image);
    imagedestroy($image);

    return ob_get_clean();
}

/**
 * Normalize Intervention's hexadecimal representation across supported drivers.
 */
function normalizedFramePixelHex(
    ImageInterface $image,
    int $x,
    int $y,
): string {
    return strtolower(
        ltrim($image->colorAt($x, $y)->toHex(), '#'),
    );
}

test('transparent template opening reveals the captured photo while opaque frame remains above it', function () {
    Storage::fake('public');

    Storage::disk('public')->put(
        'templates/transparent-frame.png',
        transparentPhotoFramePng(),
    );

    $service = app(ColorCompositionService::class);

    $composite = $service->compose(
        [
            'layout_path' => 'templates/transparent-frame.png',
            'layout_config' => [
                'slots' => [
                    [
                        'slot' => 1,
                        'x' => 0,
                        'y' => 0,
                        'width' => 10,
                        'height' => 10,
                    ],
                ],
            ],
            'photo_slots' => 1,
            'print_width_mm' => 10,
            'print_height_mm' => 10,
        ],
        [
            templateFrameSolidPng(255, 0, 0),
        ],
        null,
    );

    $centerX = intdiv($composite->width(), 2);
    $centerY = intdiv($composite->height(), 2);

    expect(
        normalizedFramePixelHex(
            $composite,
            $centerX,
            $centerY,
        ),
    )->toBe('ff0000');

    expect(
        normalizedFramePixelHex($composite, 1, 1),
    )->toBe('0000ff');
});

test('template frame is resized to the exact print canvas without cropping its edges', function () {
    Storage::fake('public');

    Storage::disk('public')->put(
        'templates/two-color-frame.png',
        twoColorTemplateFramePng(),
    );

    $composite = app(ColorCompositionService::class)
        ->compose(
            [
                'layout_path' => 'templates/two-color-frame.png',
                'layout_config' => null,
                'photo_slots' => 0,
                'print_width_mm' => 10,
                'print_height_mm' => 10,
            ],
            [],
            null,
        );

    $centerY = intdiv($composite->height(), 2);

    expect(
        normalizedFramePixelHex(
            $composite,
            1,
            $centerY,
        ),
    )->toBe('0000ff');

    expect(
        normalizedFramePixelHex(
            $composite,
            $composite->width() - 2,
            $centerY,
        ),
    )->toBe('ffff00');
});

test('selected sticker remains above the template frame', function () {
    Storage::fake('public');

    Storage::disk('public')->put(
        'templates/blue-frame.png',
        templateFrameSolidPng(0, 0, 255),
    );

    Storage::disk('public')->put(
        'stickers/green-sticker.png',
        templateFrameSolidPng(0, 255, 0),
    );

    $composite = app(ColorCompositionService::class)
        ->compose(
            [
                'layout_path' => 'templates/blue-frame.png',
                'layout_config' => null,
                'photo_slots' => 0,
                'print_width_mm' => 10,
                'print_height_mm' => 10,
            ],
            [],
            [
                'asset_path' => 'stickers/green-sticker.png',
            ],
        );

    expect(
        normalizedFramePixelHex(
            $composite,
            $composite->width() - 10,
            $composite->height() - 10,
        ),
    )->toBe('00ff00');
});

test('black and white derivative is created from the already framed composition', function () {
    Storage::fake('public');

    Storage::disk('public')->put(
        'templates/transparent-frame.png',
        transparentPhotoFramePng(),
    );

    $service = app(ColorCompositionService::class);

    $color = $service->compose(
        [
            'layout_path' => 'templates/transparent-frame.png',
            'layout_config' => [
                'slots' => [
                    [
                        'slot' => 1,
                        'x' => 0,
                        'y' => 0,
                        'width' => 10,
                        'height' => 10,
                    ],
                ],
            ],
            'photo_slots' => 1,
            'print_width_mm' => 10,
            'print_height_mm' => 10,
        ],
        [
            templateFrameSolidPng(255, 0, 0),
        ],
        null,
    );

    $blackAndWhite = $service->toBlackAndWhite($color);

    $centerX = intdiv($blackAndWhite->width(), 2);
    $centerY = intdiv($blackAndWhite->height(), 2);

    expect(
        $blackAndWhite->colorAt(1, 1)->isGrayscale(),
    )->toBeTrue();

    expect(
        $blackAndWhite
            ->colorAt($centerX, $centerY)
            ->isGrayscale(),
    )->toBeTrue();

    expect(
        normalizedFramePixelHex(
            $blackAndWhite,
            1,
            1,
        ),
    )->not->toBe(
        normalizedFramePixelHex(
            $blackAndWhite,
            $centerX,
            $centerY,
        ),
    );
});
