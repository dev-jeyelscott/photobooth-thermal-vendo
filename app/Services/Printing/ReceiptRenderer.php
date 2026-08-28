<?php

namespace App\Services\Printing;

use App\Models\CapturedMedia;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Alignment;
use Intervention\Image\Colors\Rgb\Channels\Red;
use Intervention\Image\Encoders\PngEncoder;
use Intervention\Image\ImageManager;
use Intervention\Image\Interfaces\ImageInterface;
use Intervention\Image\Typography\FontFactory;

/**
 * Renders a CapturedMedia black-and-white composite into printer-width
 * appropriate, threshold thermal print output, independent of any specific
 * PrinterDriver transport.
 */
class ReceiptRenderer
{
    /**
     * Height, in pixels, of the footer band reserved for the optional
     * session reference and date overlay.
     */
    private const FOOTER_HEIGHT_PX = 40;

    /**
     * GD internal font index (1-5) used for the footer overlay, avoiding a
     * dependency on a bundled TTF font asset.
     */
    private const FOOTER_FONT_SIZE = 4;

    public function __construct(private readonly ImageManager $imageManager) {}

    /**
     * Render the given captured media's bw_path image into thermal printer
     * output and persist it to a new storage path, leaving the original
     * bw_path file untouched.
     */
    public function render(CapturedMedia $capturedMedia): string
    {
        $source = $this->imageManager->decode(Storage::disk(config('filesystems.media'))->get($capturedMedia->bw_path));

        $rendered = (clone $source)->scale(width: (int) config('photobooth.receipt_printer_width_px'));

        $this->threshold($rendered, (int) config('photobooth.receipt_threshold'));

        if (config('photobooth.receipt_include_session_info')) {
            $this->appendSessionInfo($rendered, $capturedMedia);
        }

        $path = 'receipts/'.$capturedMedia->public_token.'-receipt.png';

        Storage::disk(config('filesystems.media'))->put($path, (string) $rendered->encode(new PngEncoder));

        return $path;
    }

    /**
     * Force every pixel to pure black or white based on its luminance,
     * matching the binary tonal range thermal printer heads can render.
     */
    private function threshold(ImageInterface $image, int $threshold): void
    {
        $image->grayscale();

        for ($y = 0; $y < $image->height(); $y++) {
            for ($x = 0; $x < $image->width(); $x++) {
                $luminance = (int) $image->colorAt($x, $y)->channel(Red::class)->value();
                $image->drawPixel($x, $y, $luminance >= $threshold ? '#ffffff' : '#000000');
            }
        }
    }

    /**
     * Extend the canvas with a white footer band and overlay the session
     * reference and date, giving the printed receipt a lookup reference.
     */
    private function appendSessionInfo(ImageInterface $image, CapturedMedia $capturedMedia): void
    {
        $originalHeight = $image->height();

        $image->resizeCanvasRelative(height: self::FOOTER_HEIGHT_PX, background: '#ffffff', alignment: Alignment::TOP);

        $label = $capturedMedia->photoboothSession?->session_token.' '.now()->toDateString();

        $image->text($label, 8, $originalHeight + (self::FOOTER_HEIGHT_PX / 2), function (FontFactory $font): void {
            $font->size(self::FOOTER_FONT_SIZE);
            $font->color('#000000');
            $font->align('left', 'center');
        });
    }
}
