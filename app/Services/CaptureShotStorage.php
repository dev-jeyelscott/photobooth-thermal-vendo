<?php

namespace App\Services;

use App\Models\PhotoboothSession;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Encoders\AutoEncoder;
use Intervention\Image\ImageManager;

class CaptureShotStorage
{
    private const JPEG_QUALITY = 92;

    public function __construct(private readonly ImageManager $imageManager) {}

    /**
     * Store an uploaded capture-step frame under the session's captures
     * directory via the configured media disk, downscaling it first if it exceeds the
     * configured maximum dimension. Frames already within bounds are stored
     * as-is, unmodified. Returns the stored path.
     */
    public function store(PhotoboothSession $session, UploadedFile $shot): string
    {
        $maxDimension = (int) config('photobooth.captured_frame_max_dimension_px');

        $dimensions = getimagesize($shot->getRealPath());
        $extension = $shot->getClientOriginalExtension() ?: 'jpg';
        $path = 'captures/'.$session->session_token.'/'.(string) Str::uuid().'.'.$extension;

        if ($dimensions !== false && ($dimensions[0] > $maxDimension || $dimensions[1] > $maxDimension)) {
            $downscaled = $this->imageManager
                ->decode($shot->get())
                ->scaleDown($maxDimension, $maxDimension);

            Storage::disk(config('filesystems.media'))->put(
                $path,
                (string) $downscaled->encode(new AutoEncoder(quality: self::JPEG_QUALITY)),
            );

            return $path;
        }

        Storage::disk(config('filesystems.media'))->put($path, (string) $shot->get());

        return $path;
    }
}
