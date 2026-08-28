<?php

namespace App\Services\Payments;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PayMongoMode;
use App\Enums\PhotoboothSessionStatus;
use App\Models\Payment;
use App\Models\PhotoboothSession;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class PayMongoPaymentStateApplier
{
    /**
     * Apply verified PayMongo financial success exactly once.
     */
    public function applyPaid(
        Payment $payment,
        int $paymongoAccountId,
        string $paymentIntentId,
        string $providerPaymentId,
        int $amountCentavos,
        string $currency,
        bool $livemode,
        string $providerStatus,
    ): void {
        DB::transaction(function () use (
            $payment,
            $paymongoAccountId,
            $paymentIntentId,
            $providerPaymentId,
            $amountCentavos,
            $currency,
            $livemode,
            $providerStatus,
        ): void {
            $lockedPayment = $this->lockPayment(
                $payment->id,
                $paymongoAccountId,
            );

            $this->assertFinancialEvidence(
                $lockedPayment,
                $paymentIntentId,
                $providerPaymentId,
                $amountCentavos,
                $currency,
                $livemode,
            );

            if ($lockedPayment->status !== PaymentStatus::Success) {
                $lockedPayment->update([
                    'status' => PaymentStatus::Success,
                    'paymongo_payment_id' => $providerPaymentId,
                    'provider_status' => $providerStatus,
                    'paid_at' => $lockedPayment->paid_at ?? now(),
                    'failed_at' => null,
                    'cancelled_at' => null,
                ]);
            }

            $session = PhotoboothSession::query()
                ->whereKey($lockedPayment->photobooth_session_id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($session->status === PhotoboothSessionStatus::Paid) {
                return;
            }

            if (
                $session->status === PhotoboothSessionStatus::PaymentPending
                && ! $session->isExpired()
            ) {
                $session->transitionTo(PhotoboothSessionStatus::Paid);

                return;
            }

            if (
                $session->status === PhotoboothSessionStatus::PaymentPending
                && $session->isExpired()
            ) {
                $session->update([
                    'status' => PhotoboothSessionStatus::Expired,
                ]);
            }

            $this->logReconciliationCondition(
                $lockedPayment,
                $session,
                $providerStatus,
            );
        });
    }

    /**
     * Apply a verified PayMongo payment failure without overriding financial success.
     */
    public function applyFailed(
        Payment $payment,
        int $paymongoAccountId,
        string $paymentIntentId,
        string $providerPaymentId,
        int $amountCentavos,
        string $currency,
        bool $livemode,
        string $providerStatus,
    ): void {
        DB::transaction(function () use (
            $payment,
            $paymongoAccountId,
            $paymentIntentId,
            $providerPaymentId,
            $amountCentavos,
            $currency,
            $livemode,
            $providerStatus,
        ): void {
            $lockedPayment = $this->lockPayment(
                $payment->id,
                $paymongoAccountId,
            );

            $this->assertFinancialEvidence(
                $lockedPayment,
                $paymentIntentId,
                $providerPaymentId,
                $amountCentavos,
                $currency,
                $livemode,
            );

            if ($lockedPayment->status !== PaymentStatus::Pending) {
                return;
            }

            $lockedPayment->update([
                'status' => PaymentStatus::Failed,
                'paymongo_payment_id' => $providerPaymentId,
                'provider_status' => $providerStatus,
                'failed_at' => now(),
                'cancelled_at' => null,
            ]);
        });
    }

    /**
     * Apply QR Ph expiry using exact locally stored provider resource ownership.
     */
    public function applyExpired(
        Payment $payment,
        int $paymongoAccountId,
        bool $livemode,
        string $providerStatus,
        ?string $paymentMethodId = null,
        ?string $paymentIntentId = null,
    ): void {
        DB::transaction(function () use (
            $payment,
            $paymongoAccountId,
            $livemode,
            $providerStatus,
            $paymentMethodId,
            $paymentIntentId,
        ): void {
            $lockedPayment = $this->lockPayment(
                $payment->id,
                $paymongoAccountId,
            );

            $this->assertMode($lockedPayment, $livemode);

            if (
                $paymentMethodId !== null
                && $lockedPayment->paymongo_payment_method_id !== $paymentMethodId
            ) {
                throw new RuntimeException(
                    'PayMongo payment method identity mismatch.',
                );
            }

            if (
                $paymentIntentId !== null
                && $lockedPayment->paymongo_payment_intent_id !== $paymentIntentId
            ) {
                throw new RuntimeException(
                    'PayMongo payment intent identity mismatch.',
                );
            }

            if ($paymentMethodId === null && $paymentIntentId === null) {
                throw new RuntimeException(
                    'PayMongo expiry event has no trusted local provider identity.',
                );
            }

            if ($lockedPayment->status !== PaymentStatus::Pending) {
                return;
            }

            $lockedPayment->update([
                'status' => PaymentStatus::Cancelled,
                'provider_status' => $providerStatus,
                'cancelled_at' => now(),
                'failed_at' => null,
            ]);
        });
    }

    /**
     * Persist a non-terminal reconciled provider status without changing durable payment authority.
     */
    public function recordPendingProviderStatus(
        Payment $payment,
        int $paymongoAccountId,
        bool $livemode,
        string $providerStatus,
    ): void {
        DB::transaction(function () use (
            $payment,
            $paymongoAccountId,
            $livemode,
            $providerStatus,
        ): void {
            $lockedPayment = $this->lockPayment(
                $payment->id,
                $paymongoAccountId,
            );

            $this->assertMode($lockedPayment, $livemode);

            if ($lockedPayment->status !== PaymentStatus::Pending) {
                return;
            }

            $lockedPayment->update([
                'provider_status' => $providerStatus,
            ]);
        });
    }

    /**
     * Lock the exact tenant PayMongo payment attempt.
     */
    private function lockPayment(
        int $paymentId,
        int $paymongoAccountId,
    ): Payment {
        $payment = Payment::query()
            ->whereKey($paymentId)
            ->where('paymongo_account_id', $paymongoAccountId)
            ->lockForUpdate()
            ->first();

        if ($payment === null) {
            throw new RuntimeException(
                'PayMongo payment account ownership mismatch.',
            );
        }

        if ($payment->method !== PaymentMethod::PayMongoQrPh) {
            throw new RuntimeException(
                'Payment is not a PayMongo QR Ph attempt.',
            );
        }

        return $payment;
    }

    /**
     * Verify immutable provider identity, mode, amount, and currency before financial mutation.
     */
    private function assertFinancialEvidence(
        Payment $payment,
        string $paymentIntentId,
        string $providerPaymentId,
        int $amountCentavos,
        string $currency,
        bool $livemode,
    ): void {
        $this->assertMode($payment, $livemode);

        if (
            $payment->paymongo_payment_intent_id === null
            || ! hash_equals(
                $payment->paymongo_payment_intent_id,
                $paymentIntentId,
            )
        ) {
            throw new RuntimeException(
                'PayMongo payment intent identity mismatch.',
            );
        }

        if (
            $payment->paymongo_payment_id !== null
            && ! hash_equals(
                $payment->paymongo_payment_id,
                $providerPaymentId,
            )
        ) {
            throw new RuntimeException(
                'PayMongo payment identity mismatch.',
            );
        }

        if ($this->toCentavos((string) $payment->amount) !== $amountCentavos) {
            throw new RuntimeException(
                'PayMongo payment amount mismatch.',
            );
        }

        if (
            $payment->currency === null
            || ! hash_equals(
                strtoupper($payment->currency),
                strtoupper($currency),
            )
        ) {
            throw new RuntimeException(
                'PayMongo payment currency mismatch.',
            );
        }
    }

    /**
     * Verify Test and Live provider evidence against the historical account version.
     */
    private function assertMode(Payment $payment, bool $livemode): void
    {
        $account = $payment->payMongoAccount()->firstOrFail();

        $expectedLivemode = $account->mode === PayMongoMode::Live;

        if ($livemode !== $expectedLivemode) {
            throw new RuntimeException(
                'PayMongo payment mode mismatch.',
            );
        }
    }

    /**
     * Convert the stored decimal amount to centavos without binary floating-point arithmetic.
     */
    private function toCentavos(string $amount): int
    {
        if (preg_match('/^\d+(?:\.\d{1,2})?$/D', $amount) !== 1) {
            throw new RuntimeException(
                'Stored PayMongo payment amount is invalid.',
            );
        }

        [$whole, $fraction] = array_pad(
            explode('.', $amount, 2),
            2,
            '',
        );

        return ((int) $whole * 100)
            + (int) str_pad($fraction, 2, '0');
    }

    /**
     * Record a verified financial success that cannot safely reopen the session.
     */
    private function logReconciliationCondition(
        Payment $payment,
        PhotoboothSession $session,
        string $providerStatus,
    ): void {
        Log::warning(
            'Verified PayMongo payment succeeded but the photobooth session was not reopened.',
            [
                'payment_id' => $payment->id,
                'photobooth_session_id' => $session->id,
                'paymongo_account_id' => $payment->paymongo_account_id,
                'paymongo_payment_intent_id' => $payment->paymongo_payment_intent_id,
                'paymongo_payment_id' => $payment->paymongo_payment_id,
                'payment_status' => $payment->status->value,
                'session_status' => $session->status->value,
                'provider_status' => $providerStatus,
            ],
        );
    }
}
