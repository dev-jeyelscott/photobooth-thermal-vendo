<?php

namespace App\Http\Controllers;

use App\Enums\PhotoboothSessionStatus;
use App\Models\PhotoboothSession;
use App\Services\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class PhotoboothSessionController extends Controller
{
    /**
     * Start a new photobooth session for a customer.
     */
    public function store(): JsonResponse
    {
        if (Settings::get('maintenance_mode')) {
            return response()->json([
                'message' => Settings::get('maintenance_message'),
                'maintenance' => true,
            ], 503);
        }

        $session = PhotoboothSession::create([
            'session_token' => (string) Str::uuid(),
            'status' => PhotoboothSessionStatus::New,
            'started_at' => now(),
            'expires_at' => now()->addMinutes((int) config('photobooth.kiosk_session_ttl_minutes')),
        ]);

        return response()->json($this->present($session), 201);
    }

    /**
     * Resume an existing photobooth session, e.g. after a page refresh.
     */
    public function show(string $sessionToken): JsonResponse
    {
        $session = PhotoboothSession::where('session_token', $sessionToken)->first();

        if (! $session) {
            return response()->json(['message' => 'Session not found.'], 404);
        }

        if ($session->expireIfPast() || $session->status->isTerminal()) {
            return response()->json(['message' => 'Session is no longer active.'], 410);
        }

        return response()->json($this->present($session));
    }

    /**
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
        ];
    }
}
