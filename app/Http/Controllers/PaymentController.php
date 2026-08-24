<?php

namespace App\Http\Controllers;

use App\Actions\Payments\CreateMayaCheckout;
use App\Actions\Payments\GenerateCheckoutQrCode;
use App\Enums\PaymentStatus;
use App\Enums\PhotoboothSessionStatus;
use App\Models\PhotoboothSession;
use Illuminate\Http\JsonResponse;

class PaymentController extends Controller
{
    /**
     * Session statuses eligible for creating a new payment. A payment cannot
     * be created once the session has already been paid for or progressed
     * beyond the checkout step.
     *
     * @var list<PhotoboothSessionStatus>
     */
    private const PAYABLE_STATUSES = [
        PhotoboothSessionStatus::New,
        PhotoboothSessionStatus::PaymentPending,
    ];

    /**
     * Create a Maya checkout for the active session and return both the trusted
     * checkout URL and a server-rendered QR representation for the kiosk.
     */
    public function store(
        string $sessionToken,
        CreateMayaCheckout $createMayaCheckout,
        GenerateCheckoutQrCode $generateCheckoutQrCode,
    ): JsonResponse {
        $session = PhotoboothSession::where('session_token', $sessionToken)->first();

        if (! $session) {
            return response()->json(['message' => 'Session not found.'], 404);
        }

        if ($session->expireIfPast() || ! in_array($session->status, self::PAYABLE_STATUSES, true)) {
            return response()->json(['message' => 'A payment cannot be created for the current session state.'], 409);
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
            'checkoutQrCode' => $generateCheckoutQrCode->handle($result['checkoutUrl']),
        ], 201);
    }
}
