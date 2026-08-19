<?php

namespace App\Http\Controllers;

use App\Actions\Processing\ComposeColorPhoto;
use App\Models\PhotoboothSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ColorCompositionController extends Controller
{
    /**
     * Compose the session's confirmed captured photos into the final color
     * output once the customer confirms the preview.
     */
    public function store(string $sessionToken, Request $request, ComposeColorPhoto $composeColorPhoto): JsonResponse
    {
        $session = PhotoboothSession::where('session_token', $sessionToken)->first();

        if (! $session) {
            return response()->json(['message' => 'Session not found.'], 404);
        }

        $validated = $request->validate([
            'photos' => ['required', 'array', 'min:1'],
            'photos.*' => ['required', 'string'],
        ]);

        $capturedMedia = $composeColorPhoto->handle($session, $validated['photos']);

        if ($capturedMedia === null) {
            return response()->json(['message' => 'The final photo could not be composed for the current session.'], 422);
        }

        return response()->json([
            'status' => $session->fresh()->status->value,
            'colorPath' => $capturedMedia->color_path,
            'bwPath' => $capturedMedia->bw_path,
            'gifPath' => $capturedMedia->gif_path,
            'galleryToken' => $capturedMedia->public_token,
        ]);
    }
}
