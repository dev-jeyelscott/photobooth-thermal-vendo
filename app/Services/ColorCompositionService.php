<?php

namespace App\Services;

use App\Models\PhotoTemplate;
use App\Models\StickerDesign;
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

    public function __construct(private readonly ImageManager $imageManager) {}

    /**
     * Compose the confirmed captured photos onto the template's layout_config
     * slots and overlay the selected sticker, producing a single print-ready
     * color image.
     *
     * @param  list<string>  $photos  Raw image sources (data URIs, base64, or binary), in shot order.
     */
    public function compose(PhotoTemplate $template, array $photos, ?StickerDesign $sticker): ImageInterface
    {
        $canvasWidth = $this->millimetersToPixels($template->print_width_mm);
        $canvasHeight = $this->millimetersToPixels($template->print_height_mm);

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
            $this->overlaySticker($canvas, $sticker, $canvasWidth);
        }

        return $canvas;
    }

    private function overlaySticker(ImageInterface $canvas, StickerDesign $sticker, int $canvasWidth): void
    {
        $stickerImage = $this->imageManager->decode(Storage::disk('public')->get($sticker->asset_path));

        $stickerSize = (int) round($canvasWidth * self::STICKER_SIZE_RATIO);
        $margin = (int) round($canvasWidth * self::STICKER_MARGIN_RATIO);

        $stickerImage->cover($stickerSize, $stickerSize);

        $canvas->insert(
            $stickerImage,
            $canvas->width() - $stickerSize - $margin,
            $canvas->height() - $stickerSize - $margin,
        );
    }

    /**
     * @return list<array{x: int, y: int, width: int, height: int}>
     */
    private function layoutSlots(PhotoTemplate $template): array
    {
        $slots = $template->layout_config['slots'] ?? null;

        if (! is_array($slots)) {
            return [];
        }

        $slots = collect($slots)
            ->filter(fn ($slot) => is_array($slot)
                && isset($slot['x'], $slot['y'], $slot['width'], $slot['height']))
            ->sortBy(fn (array $slot) => $slot['slot'] ?? 0)
            ->take($template->photo_slots)
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
