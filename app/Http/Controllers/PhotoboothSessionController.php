<?php

namespace App\Http\Controllers;

use App\Enums\PhotoboothSessionStatus;
use App\Models\Business;
use App\Models\PhotoboothSession;
use App\Services\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class PhotoboothSessionController extends Controller
{
    /**
     * Start a new photobooth session owned by the route-resolved Business.
     */
    public function store(Business $business): JsonResponse
    {
        if (Settings::get('maintenance_mode')) {
            return response()->json([
                'message' => Settings::get('maintenance_message'),
                'maintenance' => true,
            ], 503);
        }

        $session = $business->photoboothSessions()->create([
            'session_token' => (string) Str::uuid(),
            'status' => PhotoboothSessionStatus::New,
            'price' => (string) Settings::get('session_price'),
            'currency' => (string) Settings::get('currency'),
            'required_capture_count' => (int) Settings::get('capture_shot_count'),
            'started_at' => now(),
            'expires_at' => now()->addMinutes((int) config('photobooth.kiosk_session_ttl_minutes')),
        ]);

        return response()->json($this->present($session), 201);
    }

    /**
     * Resume the route-scoped photobooth session.
     */
    public function show(Business $business, PhotoboothSession $photoboothSession): JsonResponse
    {
        if ($photoboothSession->expireIfPast()) {
            return response()->json(['message' => 'Session is no longer active.'], 410);
        }

        if (in_array(
            $photoboothSession->status,
            [
                PhotoboothSessionStatus::Expired,
                PhotoboothSessionStatus::Abandoned,
            ],
            true,
        )) {
            return response()->json(['message' => 'Session is no longer active.'], 410);
        }

        return response()->json($this->present($photoboothSession));
    }

    /**
     * Present the browser-safe durable session state.
     *
     * @return array<string, mixed>
     */
    private function present(PhotoboothSession $session): array
    {
        return [
            'sessionToken' => $session->session_token,
            'status' => $session->status->value,
            'startedAt' => $session->started_at,
            'expiresAt' => $session->expires_at,
            'paymentStatus' => $session->payment?->status->value,
            'printJobStatus' => $session->printJob?->status->value,
            'requiredCaptureCount' => $session->template_snapshot['photo_slots'] ?? $session->required_capture_count,
            'galleryToken' => $session->capturedMedia()->latest()->first()?->public_token,
        ];
    }
}
