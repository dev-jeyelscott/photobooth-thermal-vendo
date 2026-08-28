<?php

namespace App\Http\Controllers;

use App\Actions\Preview\ConfirmSessionPreview;
use App\Models\Business;
use App\Models\PhotoboothSession;
use Illuminate\Http\JsonResponse;

class PreviewController extends Controller
{
    /**
     * Confirm the preview for the route-scoped photobooth session.
     */
    public function store(
        Business $business,
        PhotoboothSession $photoboothSession,
        ConfirmSessionPreview $confirmSessionPreview,
    ): JsonResponse {
        $confirmed = $confirmSessionPreview->handle($photoboothSession);

        if (! $confirmed) {
            return response()->json([
                'message' => 'This preview could not be confirmed for the current session.',
                'status' => $photoboothSession->fresh()->status->value,
            ], 422);
        }

        return response()->json([
            'status' => $photoboothSession->fresh()->status->value,
        ]);
    }
}
