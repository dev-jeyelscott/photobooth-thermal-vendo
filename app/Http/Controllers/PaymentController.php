<?php

namespace App\Http\Controllers;

use App\Actions\Payments\CreatePayMongoQrPayment;
use App\Exceptions\PaymentCreationException;
use App\Exceptions\PayMongoProviderException;
use App\Models\Business;
use App\Models\PhotoboothSession;
use Illuminate\Http\JsonResponse;

class PaymentController extends Controller
{
    /**
     * Create a tenant-owned PayMongo QR Ph payment for the route-scoped session.
     */
    public function store(
        Business $business,
        PhotoboothSession $photoboothSession,
        CreatePayMongoQrPayment $createPayMongoQrPayment,
    ): JsonResponse {
        try {
            $result = $createPayMongoQrPayment->handle(
                $business,
                $photoboothSession,
            );
        } catch (PaymentCreationException $exception) {
            return response()->json([
                'message' => $exception->safeMessage,
            ], $exception->httpStatus);
        } catch (PayMongoProviderException $exception) {
            return response()->json([
                'message' => $exception->outcomeUncertain
                    ? 'The payment provider response is temporarily uncertain. Please wait before trying again.'
                    : 'PayMongo could not create the QR Ph payment.',
            ], $exception->outcomeUncertain ? 503 : 502);
        }

        $payment = $result['payment'];

        return response()->json([
            'payment' => [
                'id' => $payment->id,
                'status' => $payment->status->value,
                'providerStatus' => $payment->provider_status,
                'amount' => $payment->amount,
                'currency' => $payment->currency,
                'expiresAt' => $payment->provider_expires_at?->toIso8601String(),
            ],
            'qrImageUrl' => $result['qrImageUrl'],
        ], 201);
    }
}
