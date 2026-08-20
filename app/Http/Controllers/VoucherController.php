<?php

namespace App\Http\Controllers;

use App\Actions\Vouchers\RedeemVoucher;
use App\Http\Requests\RedeemVoucherRequest;
use App\Models\PhotoboothSession;
use Illuminate\Http\JsonResponse;

class VoucherController extends Controller
{
    /**
     * Redeem a voucher code to unlock the given photobooth session.
     */
    public function store(string $sessionToken, RedeemVoucherRequest $request, RedeemVoucher $redeemVoucher): JsonResponse
    {
        $session = PhotoboothSession::where('session_token', $sessionToken)->first();

        if (! $session) {
            return response()->json(['message' => 'Session not found.'], 404);
        }

        $voucher = $redeemVoucher->handle($session, $request->validated('code'));

        if ($voucher === null) {
            return response()->json([
                'message' => 'This voucher code is invalid or can no longer be used.',
                'status' => $session->fresh()->status->value,
            ], 422);
        }

        return response()->json([
            'status' => $session->fresh()->status->value,
        ]);
    }
}
