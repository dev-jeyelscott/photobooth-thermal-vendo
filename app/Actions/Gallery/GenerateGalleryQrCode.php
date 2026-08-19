<?php

namespace App\Actions\Gallery;

use App\Models\CapturedMedia;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;

class GenerateGalleryQrCode
{
    /**
     * Pixel size, legible for a phone camera to scan from a kiosk screen.
     */
    private const SIZE = 320;

    private const MARGIN = 2;

    /**
     * Render an SVG QR code encoding the public gallery URL for the given
     * captured media, so a customer can open their gallery on another device.
     */
    public function handle(CapturedMedia $capturedMedia): string
    {
        $writer = new Writer(
            new ImageRenderer(
                new RendererStyle(self::SIZE, self::MARGIN),
                new SvgImageBackEnd,
            ),
        );

        return $writer->writeString(route('gallery.show', $capturedMedia));
    }
}
