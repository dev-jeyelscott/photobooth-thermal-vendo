<?php

namespace App\Actions\Payments;

use App\Enums\PaymentStatus;
use App\Enums\PhotoboothSessionStatus;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;

class ProcessMayaWebhook
{
    /**
     * Statuses reported by Maya that map to a terminal Payment status.
     *
     * @var array<string, PaymentStatus>
     */
    private const STATUS_MAP = [
        'PAYMENT_SUCCESS' => PaymentStatus::Success,
        'PAYMENT_FAILED' => PaymentStatus::Failed,
        'PAYMENT_CANCELLED' => PaymentStatus::Cancelled,
        'PAYMENT_EXPIRED' => PaymentStatus::Cancelled,
    ];

    /**
     * Apply a verified Maya webhook payload to the matching Payment and PhotoboothSession.
     *
     * Returns false when the payload cannot be matched to a known payment, reports an
     * unrecognized status, or fails amount validation, in which case no records are mutated.
     *
     * @param  array<string, mixed>  $payload
     */
    public function handle(array $payload): bool
    {
        $checkoutId = $payload['checkoutId'] ?? null;
        $paymentId = $payload['id'] ?? null;
        $status = $payload['status'] ?? null;
        $amount = $payload['amount']['value'] ?? null;

        if (! is_string($status) || ! array_key_exists($status, self::STATUS_MAP)) {
            return false;
        }

        if ($checkoutId === null && $paymentId === null) {
            return false;
        }

        $payment = Payment::query()
            ->where(function ($query) use ($checkoutId, $paymentId): void {
                if ($checkoutId !== null) {
                    $query->orWhere('maya_checkout_id', $checkoutId);
                }

                if ($paymentId !== null) {
                    $query->orWhere('maya_payment_id', $paymentId);
                }
            })
            ->first();

        if ($payment === null) {
            return false;
        }

        if ($amount === null || bccomp((string) $amount, (string) $payment->amount, 2) !== 0) {
            return false;
        }

        $newStatus = self::STATUS_MAP[$status];

        return DB::transaction(function () use ($payment, $newStatus, $paymentId) {
            $payment = Payment::whereKey($payment->id)->lockForUpdate()->first();

            if ($payment->status !== PaymentStatus::Pending) {
                return true;
            }

            $payment->update([
                'status' => $newStatus,
                'maya_payment_id' => $paymentId ?? $payment->maya_payment_id,
            ]);

            if ($newStatus === PaymentStatus::Success) {
                $session = $payment->photoboothSession;

                if ($session->status->canTransitionTo(PhotoboothSessionStatus::Paid)) {
                    $session->transitionTo(PhotoboothSessionStatus::Paid);
                }
            }

            return true;
        });
    }
}
