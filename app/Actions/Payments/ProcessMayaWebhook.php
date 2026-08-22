<?php

namespace App\Actions\Payments;

use App\Enums\PaymentStatus;
use App\Enums\PhotoboothSessionStatus;
use App\Models\Payment;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

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
            Log::warning('Maya webhook reported an unrecognized status.', [
                'maya_checkout_id' => $checkoutId,
                'maya_payment_id' => $paymentId,
                'status' => $status,
            ]);

            return false;
        }

        if ($checkoutId === null && $paymentId === null) {
            Log::warning('Maya webhook payload missing checkout and payment identifiers.', [
                'status' => $status,
            ]);

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
            Log::warning('Maya webhook could not be matched to a known payment.', [
                'maya_checkout_id' => $checkoutId,
                'maya_payment_id' => $paymentId,
            ]);

            return false;
        }

        if (! is_string($amount)
            || ! $this->isDecimalAmount($amount)
            || ! $this->isDecimalAmount($payment->amount)
            || bccomp($amount, $payment->amount, 2) !== 0) {
            Log::warning('Maya webhook amount failed validation.', [
                'maya_checkout_id' => $checkoutId,
                'maya_payment_id' => $paymentId,
                'payment_id' => $payment->id,
            ]);

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

    /**
     * Determine whether an amount can be safely compared using BCMath.
     *
     * @phpstan-assert-if-true numeric-string $amount
     */
    private function isDecimalAmount(string $amount): bool
    {
        return preg_match('/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/D', $amount) === 1;
    }
}
