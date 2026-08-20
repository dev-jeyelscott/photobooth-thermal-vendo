<?php

namespace App\Http\Controllers;

use App\Actions\Processing\ComposeColorPhoto;
use App\Http\Requests\ComposeColorPhotoRequest;
use App\Models\PhotoboothSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Throwable;

class ColorCompositionController extends Controller
{
    /**
     * Compose the session's confirmed captured photos into the final color
     * output once the customer confirms the preview.
     */
    public function store(string $sessionToken, ComposeColorPhotoRequest $request, ComposeColorPhoto $composeColorPhoto): JsonResponse
    {
        $session = PhotoboothSession::where('session_token', $sessionToken)->first();

        if (! $session) {
            return response()->json(['message' => 'Session not found.'], 404);
        }

        $validated = $request->validated();

        try {
            $capturedMedia = $composeColorPhoto->handle($session, $validated['photos']);
        } catch (Throwable $exception) {
            Log::error('Photo processing failed.', [
                'photobooth_session_id' => $session->id,
                'error' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => 'Your photos could not be processed. Please try again.',
                'status' => $session->fresh()->status->value,
            ], 500);
        }

        if ($capturedMedia === null) {
            return response()->json([
                'message' => 'The final photo could not be composed for the current session.',
                'status' => $session->fresh()->status->value,
            ], 422);
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
