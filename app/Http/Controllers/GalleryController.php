<?php

namespace App\Http\Controllers;

use App\Actions\Gallery\GenerateGalleryQrCode;
use App\Models\CapturedMedia;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class GalleryController extends Controller
{
    /**
     * Render the public gallery page for a session's captured media,
     * resolved solely by its unguessable public token.
     */
    public function show(CapturedMedia $capturedMedia): Response
    {
        return Inertia::render('gallery', [
            'colorUrl' => $capturedMedia->color_path ? Storage::disk('public')->url($capturedMedia->color_path) : null,
            'bwUrl' => $capturedMedia->bw_path ? Storage::disk('public')->url($capturedMedia->bw_path) : null,
            'gifUrl' => $capturedMedia->gif_path ? Storage::disk('public')->url($capturedMedia->gif_path) : null,
        ]);
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
}
