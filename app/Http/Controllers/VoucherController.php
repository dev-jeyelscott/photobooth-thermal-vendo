<?php

namespace App\Http\Controllers;

use App\Actions\Vouchers\RedeemVoucher;
use App\Http\Requests\RedeemVoucherRequest;
use App\Models\Business;
use App\Models\PhotoboothSession;
use Illuminate\Http\JsonResponse;

class VoucherController extends Controller
{
    /**
     * Redeem a voucher against the route-scoped photobooth session.
     */
    public function store(
        Business $business,
        PhotoboothSession $photoboothSession,
        RedeemVoucherRequest $request,
        RedeemVoucher $redeemVoucher,
    ): JsonResponse {
        $voucher = $redeemVoucher->handle(
            $photoboothSession,
            $request->validated('code'),
        );

        if ($voucher === null) {
            return response()->json([
                'message' => 'This voucher code is invalid or can no longer be used.',
                'status' => $photoboothSession->fresh()->status->value,
            ], 422);
        }

        return response()->json([
            'status' => $photoboothSession->fresh()->status->value,
        ]);
    }
}
