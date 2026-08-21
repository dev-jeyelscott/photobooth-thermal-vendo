<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;
use Intervention\Image\ImageManager;
use Intervention\Image\Interfaces\ImageInterface;

class ColorCompositionService
{
    /**
     * Resolution used to render the composite so it is sharp enough for both
     * digital download and thermal printing.
     */
    private const CANVAS_DPI = 300;

    private const MILLIMETERS_PER_INCH = 25.4;

    /**
     * Size and margin of the sticker overlay relative to the canvas width,
     * matching the ratios used to render the customer-facing preview.
     */
    private const STICKER_SIZE_RATIO = 0.22;

    private const STICKER_MARGIN_RATIO = 0.03;

    /**
     * Contrast boost applied to the grayscale derivative so thermal printers,
     * which have a narrower tonal range than digital displays, retain
     * visible separation between light and dark areas.
     */
    private const THERMAL_CONTRAST_LEVEL = 20;

    public function __construct(private readonly ImageManager $imageManager) {}

    /**
     * Compose the confirmed captured photos onto the template snapshot's
     * layout_config slots and overlay the selected sticker snapshot,
     * producing a single print-ready color image.
     *
     * @param  array{layout_config: array<string, mixed>|null, photo_slots: int, print_width_mm: int, print_height_mm: int}  $template  Snapshot of the rendering-critical template configuration.
     * @param  list<string>  $photos  Raw image sources (data URIs, base64, or binary), in shot order.
     * @param  array{asset_path: string, placement?: array{size_ratio?: float, margin_ratio?: float}|null}|null  $sticker  Snapshot of the selected sticker's rendering-critical configuration.
     */
    public function compose(array $template, array $photos, ?array $sticker): ImageInterface
    {
        $canvasWidth = $this->millimetersToPixels($template['print_width_mm']);
        $canvasHeight = $this->millimetersToPixels($template['print_height_mm']);

        $canvas = $this->imageManager->createImage($canvasWidth, $canvasHeight)->fill('#ffffff');

        foreach ($this->layoutSlots($template) as $index => $slot) {
            if (! isset($photos[$index])) {
                continue;
            }

            $slotWidth = $this->millimetersToPixels($slot['width']);
            $slotHeight = $this->millimetersToPixels($slot['height']);

            $photo = $this->imageManager->decode($photos[$index])->cover($slotWidth, $slotHeight);

            $canvas->insert($photo, $this->millimetersToPixels($slot['x']), $this->millimetersToPixels($slot['y']));
        }

        if ($sticker !== null) {
            $this->overlaySticker($canvas, $sticker['asset_path'], $canvasWidth, $sticker['placement'] ?? null);
        }

        return $canvas;
    }

    /**
     * Derive a grayscale, contrast-boosted version of an already-composed
     * image for thermal printing, without recomposing the layout.
     */
    public function toBlackAndWhite(ImageInterface $composite): ImageInterface
    {
        return (clone $composite)
            ->grayscale()
            ->contrast(self::THERMAL_CONTRAST_LEVEL);
    }

    /**
     * @param  array{size_ratio?: float, margin_ratio?: float}|null  $placement  Sticker-specific size/margin ratios, falling back to the hardcoded constants when absent.
     */
    private function overlaySticker(ImageInterface $canvas, string $assetPath, int $canvasWidth, ?array $placement): void
    {
        $stickerImage = $this->imageManager->decode(Storage::disk('public')->get($assetPath));

        $sizeRatio = $placement['size_ratio'] ?? self::STICKER_SIZE_RATIO;
        $marginRatio = $placement['margin_ratio'] ?? self::STICKER_MARGIN_RATIO;

        $stickerSize = (int) round($canvasWidth * $sizeRatio);
        $margin = (int) round($canvasWidth * $marginRatio);

        $stickerImage->cover($stickerSize, $stickerSize);

        $canvas->insert(
            $stickerImage,
            $canvas->width() - $stickerSize - $margin,
            $canvas->height() - $stickerSize - $margin,
        );
    }

    /**
     * @param  array{layout_config: array<string, mixed>|null, photo_slots: int, print_width_mm: int, print_height_mm: int}  $template
     * @return list<array{x: int, y: int, width: int, height: int}>
     */
    private function layoutSlots(array $template): array
    {
        $slots = $template['layout_config']['slots'] ?? null;

        if (! is_array($slots)) {
            return [];
        }

        $slots = collect($slots)
            ->filter(fn ($slot) => is_array($slot)
                && isset($slot['x'], $slot['y'], $slot['width'], $slot['height']))
            ->sortBy(fn (array $slot) => $slot['slot'] ?? 0)
            ->take($template['photo_slots'])
            ->map(fn (array $slot): array => [
                'x' => (int) $slot['x'],
                'y' => (int) $slot['y'],
                'width' => (int) $slot['width'],
                'height' => (int) $slot['height'],
            ]);

        return array_values($slots->all());
    }

    private function millimetersToPixels(int $millimeters): int
    {
        return (int) round($millimeters / self::MILLIMETERS_PER_INCH * self::CANVAS_DPI);
    }
}
