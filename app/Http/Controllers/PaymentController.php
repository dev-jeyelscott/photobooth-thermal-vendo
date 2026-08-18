<?php

namespace App\Http\Controllers;

use App\Actions\Payments\CreateMayaCheckout;
use App\Enums\PaymentStatus;
use App\Models\PhotoboothSession;
use Illuminate\Http\JsonResponse;

class PaymentController extends Controller
{
    /**
     * Create a Maya checkout session for the given photobooth session.
     */
    public function store(string $sessionToken, CreateMayaCheckout $createMayaCheckout): JsonResponse
    {
        $session = PhotoboothSession::where('session_token', $sessionToken)->first();

        if (! $session) {
            return response()->json(['message' => 'Session not found.'], 404);
        }

        $hasActivePayment = $session->payment()
            ->whereNotIn('status', [PaymentStatus::Failed, PaymentStatus::Cancelled])
            ->exists();

        if ($hasActivePayment) {
            return response()->json(['message' => 'A payment is already in progress for this session.'], 409);
        }

        $result = $createMayaCheckout->handle($session);

        return response()->json([
            'checkoutUrl' => $result['checkoutUrl'],
        ], 201);
    }
}
