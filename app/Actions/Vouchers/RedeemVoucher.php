<?php

namespace App\Actions\Vouchers;

use App\Enums\PaymentMethod;
use App\Enums\PhotoboothSessionStatus;
use App\Models\PhotoboothSession;
use App\Models\Voucher;
use App\Services\Settings;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RedeemVoucher
{
    /**
     * Redeem the voucher matching the given code for the given photobooth session.
     *
     * Returns null when the session is expired, or the voucher does not exist, is
     * inactive, not yet valid, expired, or exhausted, in which case neither the
     * voucher nor the session is mutated. The submitted code is matched case- and
     * whitespace-insensitively without altering the stored code.
     */
    public function handle(PhotoboothSession $session, string $code): ?Voucher
    {
        if ($session->expireIfPast()) {
            return null;
        }

        $normalizedCode = Str::of($code)->trim()->upper()->value();

        return DB::transaction(function () use ($session, $normalizedCode) {
            $voucher = Voucher::whereRaw('upper(code) = ?', [$normalizedCode])->lockForUpdate()->first();

            if ($voucher === null) {
                return null;
            }

            if (! $voucher->active) {
                return null;
            }

            if ($voucher->valid_from !== null && $voucher->valid_from->isFuture()) {
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

            $session->update([
                'voucher_id' => $voucher->id,
                'price' => '0.00',
                'currency' => $session->currency ?? (string) Settings::get('currency'),
                'payment_method' => PaymentMethod::Voucher,
                'required_capture_count' => $session->required_capture_count ?? Settings::get('capture_shot_count'),
            ]);
            $session->transitionTo(PhotoboothSessionStatus::Paid);

            return $voucher;
        });
    }
}
