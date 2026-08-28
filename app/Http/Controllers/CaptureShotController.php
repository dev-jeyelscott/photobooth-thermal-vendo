<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCaptureShotRequest;
use App\Models\Business;
use App\Models\PhotoboothSession;
use App\Services\CaptureShotStorage;
use Illuminate\Http\JsonResponse;

class CaptureShotController extends Controller
{
    /**
     * Persist a kept capture shot for the route-scoped photobooth session.
     */
    public function store(
        Business $business,
        PhotoboothSession $photoboothSession,
        StoreCaptureShotRequest $request,
        CaptureShotStorage $captureShotStorage,
    ): JsonResponse {
        if ($photoboothSession->expireIfPast()) {
            return response()->json([
                'message' => 'This session has expired.',
                'status' => $photoboothSession->fresh()->status->value,
            ], 422);
        }

        $path = $captureShotStorage->store(
            $photoboothSession,
            $request->file('shot'),
        );

        return response()->json(['path' => $path]);
    }
}
