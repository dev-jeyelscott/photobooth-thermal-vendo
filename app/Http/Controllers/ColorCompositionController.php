<?php

namespace App\Http\Controllers;

use App\Actions\Processing\ComposeColorPhoto;
use App\Http\Requests\ComposeColorPhotoRequest;
use App\Jobs\ProcessCapturedMedia;
use App\Models\Business;
use App\Models\PhotoboothSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Throwable;

class ColorCompositionController extends Controller
{
    /**
     * Queue final media processing for the route-scoped photobooth session.
     */
    public function store(
        Business $business,
        PhotoboothSession $photoboothSession,
        ComposeColorPhotoRequest $request,
        ComposeColorPhoto $composeColorPhoto,
    ): JsonResponse {
        $validated = $request->validated();

        $photos = isset($validated['photo_paths'])
            ? array_map(
                fn (string $path): string => (string) Storage::disk('public')->get($path),
                $validated['photo_paths'],
            )
            : $validated['photos'];

        if (! $composeColorPhoto->canCompose($photoboothSession, $photos)) {
            return response()->json([
                'message' => 'The final photo could not be composed for the current session.',
                'status' => $photoboothSession->fresh()->status->value,
            ], 422);
        }

        try {
            ProcessCapturedMedia::dispatch(
                $photoboothSession,
                array_values(array_map(base64_encode(...), $photos)),
            );
        } catch (Throwable) {
            // The queued job owns retry behavior. Under the sync connection,
            // keep the kiosk response recoverable and let polling reconcile.
        }

        return response()->json([
            'status' => $photoboothSession->fresh()->status->value,
            'processing' => true,
        ], 202);
    }
}
