<?php

namespace App\Actions\Processing;

use App\Actions\Printing\CreatePrintJob;
use App\Enums\PhotoboothSessionStatus;
use App\Models\CapturedMedia;
use App\Models\PhotoboothSession;
use App\Services\ColorCompositionService;
use App\Services\GifCompositionService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Encoders\JpegEncoder;

class ComposeColorPhoto
{
    private const JPEG_QUALITY = 92;

    public function __construct(
        private readonly ColorCompositionService $colorComposition,
        private readonly GifCompositionService $gifComposition,
        private readonly CreatePrintJob $createPrintJob,
    ) {}

    /**
     * Compose the session's confirmed captured photos into the final color
     * print, a grayscale thermal-print-optimized derivative, and an animated
     * GIF for digital delivery, advancing the session to Processing and
     * persisting the result paths to captured_media.
     *
     * @param  list<string>  $photos
     */
    public function handle(PhotoboothSession $session, array $photos): ?CapturedMedia
    {
        if (! $this->canCompose($session, $photos)) {
            return null;
        }

        $templateSnapshot = $this->templateSnapshot($session);

        $composite = $this->colorComposition->compose(
            $templateSnapshot,
            $photos,
            $this->stickerSnapshot($session),
        );

        $blackAndWhite = $this->colorComposition->toBlackAndWhite($composite);
        $gif = $this->gifComposition->compose(
            $photos,
            (float) config('photobooth.gif_frame_duration_seconds'),
        );

        $colorPath = 'captures/'.$session->session_token.'-color.jpg';
        $bwPath = 'captures/'.$session->session_token.'-bw.jpg';
        $gifPath = 'captures/'.$session->session_token.'-animation.gif';

        Storage::disk('public')->put(
            $colorPath,
            (string) $composite->encode(new JpegEncoder(quality: self::JPEG_QUALITY)),
        );

        Storage::disk('public')->put(
            $bwPath,
            (string) $blackAndWhite->encode(new JpegEncoder(quality: self::JPEG_QUALITY)),
        );

        Storage::disk('public')->put($gifPath, (string) $gif);

        return DB::transaction(function () use (
            $session,
            $colorPath,
            $bwPath,
            $gifPath,
        ): CapturedMedia {
            $session = PhotoboothSession::whereKey($session->id)
                ->lockForUpdate()
                ->first();

            $existingMedia = $session->capturedMedia()->first();

            $stillComposable = in_array($session->status, [
                PhotoboothSessionStatus::TemplateSelected,
                PhotoboothSessionStatus::Capturing,
                PhotoboothSessionStatus::Customizing,
                PhotoboothSessionStatus::Processing,
            ], true);

            if ($existingMedia !== null && ! $stillComposable) {
                return $existingMedia;
            }

            while ($session->status !== PhotoboothSessionStatus::Processing) {
                $session->transitionTo($session->status->next());
            }

            $capturedMedia = $session->capturedMedia()->updateOrCreate(
                ['photobooth_session_id' => $session->id],
                [
                    'color_path' => $colorPath,
                    'bw_path' => $bwPath,
                    'gif_path' => $gifPath,
                    'expires_at' => now()->addHours(
                        (int) config('photobooth.gallery_expiration_hours'),
                    ),
                ],
            );

            if (! $session->printJob()->exists()) {
                $this->createPrintJob->handle($session);
            }

            return $capturedMedia;
        });
    }

    /**
     * Determine whether the session and supplied photos are eligible for
     * composition.
     *
     * @param  list<string>  $photos
     */
    public function canCompose(PhotoboothSession $session, array $photos): bool
    {
        if ($session->expireIfPast()) {
            return false;
        }

        if ($session->photo_template_id === null) {
            return false;
        }

        $allowedStartingStatuses = [
            PhotoboothSessionStatus::TemplateSelected,
            PhotoboothSessionStatus::Capturing,
            PhotoboothSessionStatus::Customizing,
            PhotoboothSessionStatus::Processing,
        ];

        if (! in_array($session->status, $allowedStartingStatuses, true)) {
            return false;
        }

        return count($photos) >= $this->templateSnapshot($session)['photo_slots'];
    }

    /**
     * Resolve rendering-critical template configuration from the immutable
     * selection-time snapshot. Historical snapshots that predate layout_path
     * may fall back to a still-existing live public-disk frame.
     *
     * @return array{layout_path: string|null, layout_config: array<string, mixed>|null, photo_slots: int, print_width_mm: int, print_height_mm: int}
     */
    private function templateSnapshot(PhotoboothSession $session): array
    {
        if ($session->template_snapshot !== null) {
            $snapshot = $session->template_snapshot;

            $layoutPath = array_key_exists('layout_path', $snapshot)
                ? (is_string($snapshot['layout_path']) ? $snapshot['layout_path'] : null)
                : $this->legacyLayoutPath($session);

            return [
                'layout_path' => $layoutPath,
                'layout_config' => $snapshot['layout_config'],
                'photo_slots' => $snapshot['photo_slots'],
                'print_width_mm' => $snapshot['print_width_mm'],
                'print_height_mm' => $snapshot['print_height_mm'],
            ];
        }

        $template = $session->photoTemplate;

        return [
            'layout_path' => $this->legacyLayoutPath($session),
            'layout_config' => $template->layout_config,
            'photo_slots' => $template->photo_slots,
            'print_width_mm' => $template->print_width_mm,
            'print_height_mm' => $template->print_height_mm,
        ];
    }

    /**
     * Return a legacy live-template frame only when its public-disk asset still
     * exists. Newly created snapshots do not use this fallback.
     */
    private function legacyLayoutPath(PhotoboothSession $session): ?string
    {
        $layoutPath = $session->photoTemplate?->layout_path;

        if (
            ! is_string($layoutPath)
            || $layoutPath === ''
            || ! Storage::disk('public')->exists($layoutPath)
        ) {
            return null;
        }

        return $layoutPath;
    }

    /**
     * Resolve the selected sticker from its immutable session snapshot or,
     * for legacy sessions, the existing live relationship.
     *
     * @return array{asset_path: string, placement: array<string, mixed>|null}|null
     */
    private function stickerSnapshot(PhotoboothSession $session): ?array
    {
        if ($session->sticker_snapshot !== null) {
            return [
                'asset_path' => (string) $session->sticker_snapshot['asset_path'],
                'placement' => $session->sticker_snapshot['placement'] ?? null,
            ];
        }

        if ($session->sticker_design_id === null) {
            return null;
        }

        return [
            'asset_path' => $session->stickerDesign->asset_path,
            'placement' => $session->stickerDesign->placement,
        ];
    }
}
