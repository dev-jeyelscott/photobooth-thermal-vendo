<?php

namespace App\Actions\Processing;

use App\Enums\PhotoboothSessionStatus;
use App\Models\CapturedMedia;
use App\Models\PhotoboothSession;
use App\Services\ColorCompositionService;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Encoders\JpegEncoder;

class ComposeColorPhoto
{
    private const JPEG_QUALITY = 92;

    public function __construct(private readonly ColorCompositionService $colorComposition) {}

    /**
     * Compose the session's confirmed captured photos into the final color
     * print and a grayscale, thermal-print-optimized derivative of the same
     * composition, advancing the session to Processing and persisting the
     * result paths to captured_media.color_path and captured_media.bw_path.
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

        $template = $session->photoTemplate;

        if (count($photos) < $template->photo_slots) {
            return null;
        }

        $composite = $this->colorComposition->compose($template, $photos, $session->stickerDesign);
        $blackAndWhite = $this->colorComposition->toBlackAndWhite($composite);

        $colorPath = 'captures/'.$session->session_token.'-color.jpg';
        $bwPath = 'captures/'.$session->session_token.'-bw.jpg';

        Storage::disk('public')->put(
            $colorPath,
            (string) $composite->encode(new JpegEncoder(quality: self::JPEG_QUALITY)),
        );

        Storage::disk('public')->put(
            $bwPath,
            (string) $blackAndWhite->encode(new JpegEncoder(quality: self::JPEG_QUALITY)),
        );

        while ($session->status !== PhotoboothSessionStatus::Processing) {
            $session->transitionTo($session->status->next());
        }

        return $session->capturedMedia()->updateOrCreate(
            ['photobooth_session_id' => $session->id],
            ['color_path' => $colorPath, 'bw_path' => $bwPath],
        );
    }
}
