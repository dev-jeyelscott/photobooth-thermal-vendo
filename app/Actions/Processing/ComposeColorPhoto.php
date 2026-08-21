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
     * persisting the result paths to captured_media.color_path,
     * captured_media.bw_path, and captured_media.gif_path.
     *
     * Returns null when the session is expired, has no template selected,
     * is not in a state that can reach Processing, or too few photos were
     * supplied for the template's photo slots.
     *
     * @param  list<string>  $photos  Raw image sources (data URIs, base64, or binary), in shot order.
     */
    public function handle(PhotoboothSession $session, array $photos): ?CapturedMedia
    {
        if ($session->expireIfPast()) {
            return null;
        }

        if ($session->photo_template_id === null) {
            return null;
        }

        $allowedStartingStatuses = [
            PhotoboothSessionStatus::TemplateSelected,
            PhotoboothSessionStatus::Capturing,
            PhotoboothSessionStatus::Customizing,
            PhotoboothSessionStatus::Processing,
        ];

        if (! in_array($session->status, $allowedStartingStatuses, true)) {
            return null;
        }

        $templateSnapshot = $this->templateSnapshot($session);

        if (count($photos) < $templateSnapshot['photo_slots']) {
            return null;
        }

        $composite = $this->colorComposition->compose($templateSnapshot, $photos, $this->stickerSnapshot($session));
        $blackAndWhite = $this->colorComposition->toBlackAndWhite($composite);
        $gif = $this->gifComposition->compose($photos, (float) config('photobooth.gif_frame_duration_seconds'));

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

        return DB::transaction(function () use ($session, $colorPath, $bwPath, $gifPath): CapturedMedia {
            while ($session->status !== PhotoboothSessionStatus::Processing) {
                $session->transitionTo($session->status->next());
            }

            $capturedMedia = $session->capturedMedia()->updateOrCreate(
                ['photobooth_session_id' => $session->id],
                [
                    'color_path' => $colorPath,
                    'bw_path' => $bwPath,
                    'gif_path' => $gifPath,
                    'expires_at' => now()->addHours((int) config('photobooth.gallery_expiration_hours')),
                ],
            );

            if (! $session->printJob()->exists()) {
                $this->createPrintJob->handle($session);
            }

            return $capturedMedia;
        });
    }

    /**
     * Resolve the rendering-critical template configuration from the
     * session's snapshot, taken at template-selection time, so later edits
     * to the PhotoTemplate do not affect an in-flight or completed session.
     * Falls back to the live relation only if the session predates
     * snapshotting.
     *
     * @return array{layout_config: array<string, mixed>|null, photo_slots: int, print_width_mm: int, print_height_mm: int}
     */
    private function templateSnapshot(PhotoboothSession $session): array
    {
        if ($session->template_photo_slots !== null
            && $session->template_print_width_mm !== null
            && $session->template_print_height_mm !== null) {
            return [
                'layout_config' => $session->template_layout_config,
                'photo_slots' => $session->template_photo_slots,
                'print_width_mm' => $session->template_print_width_mm,
                'print_height_mm' => $session->template_print_height_mm,
            ];
        }

        $template = $session->photoTemplate;

        return [
            'layout_config' => $template->layout_config,
            'photo_slots' => $template->photo_slots,
            'print_width_mm' => $template->print_width_mm,
            'print_height_mm' => $template->print_height_mm,
        ];
    }

    /**
     * Resolve the rendering-critical sticker configuration from the
     * session's snapshot, taken at sticker-selection time, so a later edit
     * to the StickerDesign's asset does not affect an in-flight or
     * completed session. Falls back to the live relation only if the
     * session predates snapshotting.
     *
     * @return array{asset_path: string}|null
     */
    private function stickerSnapshot(PhotoboothSession $session): ?array
    {
        if ($session->sticker_snapshot !== null) {
            return ['asset_path' => (string) $session->sticker_snapshot['asset_path']];
        }

        if ($session->sticker_design_id === null) {
            return null;
        }

        return ['asset_path' => $session->stickerDesign->asset_path];
    }
}
