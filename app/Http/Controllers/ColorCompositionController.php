<?php

namespace App\Http\Controllers;

use App\Actions\Processing\ComposeColorPhoto;
use App\Http\Requests\ComposeColorPhotoRequest;
use App\Jobs\ProcessCapturedMedia;
use App\Models\PhotoboothSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

class ColorCompositionController extends Controller
{
    /**
     * Validate the session's confirmed captured photos and queue their final
     * color, black-and-white, and GIF composition, returning promptly
     * instead of waiting for the image and GIF encoding to finish.
     */
    public function store(string $sessionToken, ComposeColorPhotoRequest $request, ComposeColorPhoto $composeColorPhoto): JsonResponse
    {
        $session = PhotoboothSession::where('session_token', $sessionToken)->first();

        if (! $session) {
            return response()->json(['message' => 'Session not found.'], 404);
        }

        $validated = $request->validated();

        $photos = isset($validated['photo_paths'])
            ? array_map(
                fn (string $path): string => (string) Storage::disk('public')->get($path),
                $validated['photo_paths'],
            )
            : $validated['photos'];

        if (! $composeColorPhoto->canCompose($session, $photos)) {
            return response()->json([
                'message' => 'The final photo could not be composed for the current session.',
                'status' => $session->fresh()->status->value,
            ], 422);
        }

        ProcessCapturedMedia::dispatch($session, array_values(array_map(base64_encode(...), $photos)));

        return response()->json([
            'status' => $session->fresh()->status->value,
            'processing' => true,
        ], 202);
    }
}
