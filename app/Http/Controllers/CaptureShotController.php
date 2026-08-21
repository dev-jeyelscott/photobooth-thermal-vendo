<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCaptureShotRequest;
use App\Models\PhotoboothSession;
use App\Services\CaptureShotStorage;
use Illuminate\Http\JsonResponse;

class CaptureShotController extends Controller
{
    /**
     * Persist a single kept capture-step shot to the session's captures
     * directory, independent of the final color/bw/gif composition step.
     */
    public function store(string $sessionToken, StoreCaptureShotRequest $request, CaptureShotStorage $captureShotStorage): JsonResponse
    {
        $session = PhotoboothSession::where('session_token', $sessionToken)->first();

        if (! $session) {
            return response()->json(['message' => 'Session not found.'], 404);
        }

        if ($session->expireIfPast()) {
            return response()->json([
                'message' => 'This session has expired.',
                'status' => $session->fresh()->status->value,
            ], 422);
        }

        $path = $captureShotStorage->store($session, $request->file('shot'));

        return response()->json(['path' => $path]);
    }
}
