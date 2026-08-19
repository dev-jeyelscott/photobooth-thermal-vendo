<?php

use App\Models\CapturedMedia;
use App\Services\Printing\ReceiptRenderer;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\ImageManager;

function receiptFixturePng(): string
{
    $image = imagecreatetruecolor(200, 100);
    imagefill($image, 0, 0, (int) imagecolorallocate($image, 128, 128, 128));
    ob_start();
    imagepng($image);
    imagedestroy($image);

    return ob_get_clean();
}

test('renders the captured media bw image into a threshold, printer-width bitmap', function () {
    Storage::fake('public');

    config([
        'photobooth.receipt_printer_width_px' => 384,
        'photobooth.receipt_threshold' => 128,
        'photobooth.receipt_include_session_info' => false,
    ]);

    $capturedMedia = CapturedMedia::factory()->create(['bw_path' => 'captures/fixture-bw.png']);
    Storage::disk('public')->put($capturedMedia->bw_path, receiptFixturePng());

    $path = app(ReceiptRenderer::class)->render($capturedMedia);

    expect($path)->not->toBe($capturedMedia->bw_path);

    Storage::disk('public')->assertExists($path);
    Storage::disk('public')->assertExists($capturedMedia->bw_path);

    $original = app(ImageManager::class)->decode(receiptFixturePng());
    $rendered = app(ImageManager::class)->decode(Storage::disk('public')->get($path));

    expect($rendered->width())->toBe(384)
        ->and($rendered->height())->toBe((int) round(384 * ($original->height() / $original->width())));

    foreach ([[0, 0], [$rendered->width() - 1, $rendered->height() - 1]] as [$x, $y]) {
        $color = $rendered->colorAt($x, $y);

        expect($color->isGrayscale())->toBeTrue()
            ->and($color->toHex())->toBeIn(['000000', 'ffffff']);
    }
});

test('appends a session reference footer when the config flag is enabled', function () {
    Storage::fake('public');

    config([
        'photobooth.receipt_printer_width_px' => 384,
        'photobooth.receipt_threshold' => 128,
        'photobooth.receipt_include_session_info' => true,
    ]);

    $capturedMedia = CapturedMedia::factory()->create(['bw_path' => 'captures/fixture-bw.png']);
    Storage::disk('public')->put($capturedMedia->bw_path, receiptFixturePng());

    config(['photobooth.receipt_include_session_info' => false]);
    $withoutFooterHeight = app(ImageManager::class)->decode(
        Storage::disk('public')->get(app(ReceiptRenderer::class)->render($capturedMedia))
    )->height();

    config(['photobooth.receipt_include_session_info' => true]);
    $withFooterPath = app(ReceiptRenderer::class)->render($capturedMedia);
    $withFooterHeight = app(ImageManager::class)->decode(Storage::disk('public')->get($withFooterPath))->height();

    expect($withFooterHeight)->toBe($withoutFooterHeight + 40);
});
