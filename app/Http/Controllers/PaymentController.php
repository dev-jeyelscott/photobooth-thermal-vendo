<?php

namespace App\Http\Controllers;

use App\Actions\Payments\CreateMayaCheckout;
use App\Actions\Payments\GenerateCheckoutQrCode;
use App\Enums\PaymentStatus;
use App\Enums\PhotoboothSessionStatus;
use App\Models\Business;
use App\Models\PhotoboothSession;
use Illuminate\Http\JsonResponse;

class PaymentController extends Controller
{
    /**
     * Session statuses eligible for creating a new payment.
     *
     * @var list<PhotoboothSessionStatus>
     */
    private const PAYABLE_STATUSES = [
        PhotoboothSessionStatus::New,
        PhotoboothSessionStatus::PaymentPending,
    ];

    /**
     * Create a Maya checkout for the route-scoped active session.
     */
    public function store(
        Business $business,
        PhotoboothSession $photoboothSession,
        CreateMayaCheckout $createMayaCheckout,
        GenerateCheckoutQrCode $generateCheckoutQrCode,
    ): JsonResponse {
        if (
            $photoboothSession->expireIfPast()
            || ! in_array($photoboothSession->status, self::PAYABLE_STATUSES, true)
        ) {
            return response()->json([
                'message' => 'A payment cannot be created for the current session state.',
            ], 409);
        }

        $hasActivePayment = $photoboothSession->payment()
            ->whereNotIn('status', [
                PaymentStatus::Failed,
                PaymentStatus::Cancelled,
            ])
            ->exists();

        if ($hasActivePayment) {
            return response()->json([
                'message' => 'A payment is already in progress for this session.',
            ], 409);
        }

        $result = $createMayaCheckout->handle($photoboothSession);

        return response()->json([
            'checkoutUrl' => $result['checkoutUrl'],
            'checkoutQrCode' => $generateCheckoutQrCode->handle($result['checkoutUrl']),
        ], 201);
    }
}
