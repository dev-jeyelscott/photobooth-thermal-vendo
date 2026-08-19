<?php

namespace App\Http\Controllers;

use App\Actions\Preview\ConfirmSessionPreview;
use App\Models\PhotoboothSession;
use Illuminate\Http\JsonResponse;

class PreviewController extends Controller
{
    /**
     * Confirm the customer's composed preview for the given photobooth session.
     */
    public function store(string $sessionToken, ConfirmSessionPreview $confirmSessionPreview): JsonResponse
    {
        $session = PhotoboothSession::where('session_token', $sessionToken)->first();

        if (! $session) {
            return response()->json(['message' => 'Session not found.'], 404);
        }

        $confirmed = $confirmSessionPreview->handle($session);

        if (! $confirmed) {
            return response()->json([
                'message' => 'This preview could not be confirmed for the current session.',
                'status' => $session->fresh()->status->value,
            ], 422);
        }

        return response()->json([
            'status' => $session->fresh()->status->value,
        ]);
    }
}
