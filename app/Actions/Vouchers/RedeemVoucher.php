<?php

namespace App\Actions\Vouchers;

use App\Enums\PhotoboothSessionStatus;
use App\Models\PhotoboothSession;
use App\Models\Voucher;
use Illuminate\Support\Facades\DB;

class RedeemVoucher
{
    /**
     * Redeem the voucher matching the given code for the given photobooth session.
     *
     * Returns null when the voucher does not exist, is inactive, expired, or exhausted,
     * in which case neither the voucher nor the session is mutated.
     */
    public function handle(PhotoboothSession $session, string $code): ?Voucher
    {
        return DB::transaction(function () use ($session, $code) {
            $voucher = Voucher::where('code', $code)->lockForUpdate()->first();

            if ($voucher === null) {
                return null;
            }

            if (! $voucher->active) {
                return null;
            }

            if ($voucher->expires_at !== null && $voucher->expires_at->isPast()) {
                return null;
            }

            if ($voucher->usage_count >= $voucher->usage_limit) {
                return null;
            }

            if (! $session->status->canTransitionTo(PhotoboothSessionStatus::Paid)) {
                return null;
            }

            $voucher->update(['usage_count' => $voucher->usage_count + 1]);

            $session->update(['voucher_id' => $voucher->id]);
            $session->transitionTo(PhotoboothSessionStatus::Paid);

            return $voucher;
        });
    }
}
