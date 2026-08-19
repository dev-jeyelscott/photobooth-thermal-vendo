<?php

namespace App\Services;

use Intervention\Image\Encoders\GifEncoder;
use Intervention\Image\ImageManager;
use Intervention\Image\Interfaces\AnimationFactoryInterface;
use Intervention\Image\Interfaces\EncodedImageInterface;

class GifCompositionService
{
    /**
     * Target ceiling for the encoded GIF, chosen to keep digital delivery
     * downloads fast over mobile data connections.
     */
    private const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024;

    /**
     * Frame width the animation is downscaled to before encoding, capping
     * the dominant driver of GIF file size.
     */
    private const FRAME_WIDTH_PX = 480;

    /**
     * Successive color palette sizes tried, in order, until the encoded GIF
     * fits within MAX_FILE_SIZE_BYTES. GIF has no lossy quality setting, so
     * palette size is the remaining lever once frames are already downscaled.
     */
    private const COLOR_PALETTE_SIZES = [256, 128, 64, 32];

    public function __construct(private readonly ImageManager $imageManager) {}

    /**
     * Sequence the session's captured photos into an animated GIF, reducing
     * the color palette as needed to stay within MAX_FILE_SIZE_BYTES.
     *
     * @param  list<string>  $photos  Raw image sources (data URIs, base64, or binary), in shot order.
     */
    public function compose(array $photos, float $frameDurationSeconds): EncodedImageInterface
    {
        $firstFrame = $this->imageManager->decode($photos[0]);

        $width = min($firstFrame->width(), self::FRAME_WIDTH_PX);
        $height = (int) round($firstFrame->height() * ($width / $firstFrame->width()));

        $encoded = null;

        foreach (self::COLOR_PALETTE_SIZES as $paletteSize) {
            $animation = $this->imageManager->createImage(
                $width,
                $height,
                function (AnimationFactoryInterface $animation) use ($photos, $frameDurationSeconds, $paletteSize): void {
                    foreach ($photos as $photo) {
                        $animation->add($photo, $frameDurationSeconds)->reduceColors($paletteSize);
                    }
                },
            );

            $encoded = $animation->encode(new GifEncoder);

            if ($encoded->size() <= self::MAX_FILE_SIZE_BYTES) {
                break;
            }
        }

        return $encoded;
    }
}
