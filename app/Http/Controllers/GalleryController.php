<?php

namespace App\Http\Controllers;

use App\Actions\Gallery\GenerateGalleryQrCode;
use App\Models\CapturedMedia;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class GalleryController extends Controller
{
    /**
     * Render the public gallery page for a session's captured media,
     * resolved solely by its unguessable public token.
     */
    public function show(CapturedMedia $capturedMedia): Response
    {
        if ($capturedMedia->isExpired()) {
            return Inertia::render('gallery', [
                'expired' => true,
                'colorUrl' => null,
                'bwUrl' => null,
                'gifUrl' => null,
            ]);
        }

        return Inertia::render('gallery', [
            'expired' => false,
            'colorUrl' => $this->mediaUrl($capturedMedia, 'color'),
            'bwUrl' => $this->mediaUrl($capturedMedia, 'bw'),
            'gifUrl' => $this->mediaUrl($capturedMedia, 'gif'),
            'expiresAt' => $capturedMedia->expires_at?->toIso8601String(),
        ]);
    }

    /**
     * Stream one generated gallery asset through the token and expiration
     * boundary instead of exposing its public-disk path directly.
     */
    public function media(CapturedMedia $capturedMedia, string $variant): StreamedResponse
    {
        if ($capturedMedia->isExpired()) {
            abort(404);
        }

        $media = $this->mediaVariant($capturedMedia, $variant);

        if (
            $media === null
            || $media['path'] === null
            || ! str_starts_with($media['path'], 'captures/')
            || ! Storage::disk(config('filesystems.media'))->exists($media['path'])
        ) {
            abort(404);
        }

        return Storage::disk(config('filesystems.media'))->response(
            $media['path'],
            null,
            [
                'Content-Type' => $media['contentType'],
                'Cache-Control' => 'private, no-store, max-age=0',
                'Pragma' => 'no-cache',
                'X-Content-Type-Options' => 'nosniff',
                'X-Robots-Tag' => 'noindex, nofollow, noarchive',
            ],
            'inline',
        );
    }

    /**
     * Render an SVG QR code encoding the public gallery URL for the given
     * captured media, so it can be scanned from a kiosk screen.
     */
    public function qrCode(CapturedMedia $capturedMedia, GenerateGalleryQrCode $generateGalleryQrCode): HttpResponse
    {
        return response($generateGalleryQrCode->handle($capturedMedia), 200, [
            'Content-Type' => 'image/svg+xml',
        ]);
    }

    /**
     * Build a protected URL only when the requested gallery variant has a
     * recorded path on the captured-media record.
     */
    private function mediaUrl(CapturedMedia $capturedMedia, string $variant): ?string
    {
        $media = $this->mediaVariant($capturedMedia, $variant);

        if ($media === null || $media['path'] === null) {
            return null;
        }

        return route('gallery.media', [
            'capturedMedia' => $capturedMedia->public_token,
            'variant' => $variant,
        ]);
    }

    /**
     * Resolve the only customer-downloadable generated media variants and
     * their trusted MIME types without accepting arbitrary storage paths.
     *
     * @return array{path: string|null, contentType: string}|null
     */
    private function mediaVariant(CapturedMedia $capturedMedia, string $variant): ?array
    {
        return match ($variant) {
            'color' => [
                'path' => $capturedMedia->color_path,
                'contentType' => 'image/jpeg',
            ],
            'bw' => [
                'path' => $capturedMedia->bw_path,
                'contentType' => 'image/jpeg',
            ],
            'gif' => [
                'path' => $capturedMedia->gif_path,
                'contentType' => 'image/gif',
            ],
            default => null,
        };
    }
}
