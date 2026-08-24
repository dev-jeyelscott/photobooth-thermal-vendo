<?php

namespace App\Actions\Payments;

use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;

class GenerateCheckoutQrCode
{
    private const SIZE = 320;

    private const MARGIN = 2;

    /**
     * Render the trusted Maya checkout URL as an inline SVG data URI for the
     * kiosk. The URL comes from the server-side Maya response, never from a
     * customer-controlled QR payload.
     */
    public function handle(string $checkoutUrl): string
    {
        $writer = new Writer(
            new ImageRenderer(
                new RendererStyle(self::SIZE, self::MARGIN),
                new SvgImageBackEnd,
            ),
        );

        $svg = $writer->writeString($checkoutUrl);

        return 'data:image/svg+xml;base64,'.base64_encode($svg);
    }
}
