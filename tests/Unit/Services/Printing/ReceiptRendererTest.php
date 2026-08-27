<?php

use App\Models\CapturedMedia;
use App\Services\Printing\ReceiptRenderer;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\ImageManager;

function receiptRendererFixturePng(int $width, int $height): string
{
    $image = imagecreatetruecolor($width, $height);
    imagefill($image, 0, 0, (int) imagecolorallocate($image, 128, 128, 128));
    ob_start();
    imagepng($image);
    imagedestroy($image);

    return ob_get_clean();
}

function unsavedCapturedMedia(string $bwPath): CapturedMedia
{
    $capturedMedia = new CapturedMedia(['bw_path' => $bwPath]);
    $capturedMedia->public_token = 'fixture-token';

    return $capturedMedia;
}

test('render scales the image to the configured printer width, preserving aspect ratio', function () {
    Storage::fake('public');

    config([
        'photobooth.receipt_printer_width_px' => 384,
        'photobooth.receipt_threshold' => 128,
        'photobooth.receipt_include_session_info' => false,
    ]);

    $capturedMedia = unsavedCapturedMedia('captures/fixture-bw.png');
    Storage::disk('public')->put($capturedMedia->bw_path, receiptRendererFixturePng(200, 100));

    $path = app(ReceiptRenderer::class)->render($capturedMedia);

    $rendered = app(ImageManager::class)->decode(Storage::disk('public')->get($path));

    expect($rendered->width())->toBe(384)
        ->and($rendered->height())->toBe((int) round(384 * (100 / 200)));
});

test('render rounds a non-integer scaled height using standard rounding', function () {
    Storage::fake('public');

    config([
        'photobooth.receipt_printer_width_px' => 300,
        'photobooth.receipt_threshold' => 128,
        'photobooth.receipt_include_session_info' => false,
    ]);

    $capturedMedia = unsavedCapturedMedia('captures/fixture-odd.png');
    Storage::disk('public')->put($capturedMedia->bw_path, receiptRendererFixturePng(150, 47));

    $path = app(ReceiptRenderer::class)->render($capturedMedia);

    $rendered = app(ImageManager::class)->decode(Storage::disk('public')->get($path));

    expect($rendered->width())->toBe(300)
        ->and($rendered->height())->toBe((int) round(300 * (47 / 150)));
});

test('render leaves the canvas height unchanged when the session info footer is disabled', function () {
    Storage::fake('public');

    config([
        'photobooth.receipt_printer_width_px' => 384,
        'photobooth.receipt_threshold' => 128,
        'photobooth.receipt_include_session_info' => false,
    ]);

    $capturedMedia = unsavedCapturedMedia('captures/fixture-no-footer.png');
    Storage::disk('public')->put($capturedMedia->bw_path, receiptRendererFixturePng(200, 100));

    $path = app(ReceiptRenderer::class)->render($capturedMedia);
    $rendered = app(ImageManager::class)->decode(Storage::disk('public')->get($path));

    expect($rendered->height())->toBe((int) round(384 * (100 / 200)));
});

test('every pixel of the rendered image is pure black or white after thresholding', function () {
    Storage::fake('public');

    config([
        'photobooth.receipt_printer_width_px' => 64,
        'photobooth.receipt_threshold' => 128,
        'photobooth.receipt_include_session_info' => false,
    ]);

    $capturedMedia = unsavedCapturedMedia('captures/fixture-threshold.png');
    Storage::disk('public')->put($capturedMedia->bw_path, receiptRendererFixturePng(64, 32));

    $path = app(ReceiptRenderer::class)->render($capturedMedia);
    $rendered = app(ImageManager::class)->decode(Storage::disk('public')->get($path));

    foreach ([[0, 0], [$rendered->width() - 1, $rendered->height() - 1]] as [$x, $y]) {
        expect($rendered->colorAt($x, $y)->toHex())->toBeIn(['000000', 'ffffff']);
    }
});
