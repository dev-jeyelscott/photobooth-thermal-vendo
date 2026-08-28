<?php

namespace App\Actions\Payments;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PhotoboothSessionStatus;
use App\Exceptions\PaymentCreationException;
use App\Exceptions\PayMongoProviderException;
use App\Models\Business;
use App\Models\Payment;
use App\Models\PayMongoAccount;
use App\Models\PhotoboothSession;
use App\Services\Payments\PayMongoQrPhClient;
use App\Services\Payments\TenantPayMongoAccountResolver;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class CreatePayMongoQrPayment
{
    private const MIN_QR_EXPIRY_SECONDS = 60;

    private const MAX_QR_EXPIRY_SECONDS = 9000;

    /**
     * Create the action with tenant resolution and provider boundaries.
     */
    public function __construct(
        private readonly TenantPayMongoAccountResolver $accountResolver,
        private readonly PayMongoQrPhClient $payMongo,
    ) {}

    /**
     * Create one durable local attempt before creating PayMongo QR Ph resources.
     *
     * @return array{payment: Payment, qrImageUrl: string}
     */
    public function handle(
        Business $business,
        PhotoboothSession $session,
    ): array {
        $resolvedAccount = $this->resolveAccount($business);

        [$payment, $amountCentavos] = $this->createLocalAttempt(
            $business,
            $session,
            $resolvedAccount,
        );

        try {
            $intent = $this->payMongo->createPaymentIntent(
                $resolvedAccount,
                $payment,
                $amountCentavos,
            );

            $payment->update([
                'paymongo_payment_intent_id' => $intent['id'],
                'provider_status' => $intent['status'],
            ]);

            $expirySeconds = $this->remainingQrExpirySeconds($payment);

            if ($expirySeconds < self::MIN_QR_EXPIRY_SECONDS) {
                $this->markExpiredBeforeQr($payment);

                throw new PaymentCreationException(
                    'There is not enough session time remaining to create a QR Ph payment.',
                    409,
                );
            }

            $paymentMethod = $this->payMongo->createPaymentMethod(
                $resolvedAccount,
                $payment,
                $expirySeconds,
            );

            $payment->update([
                'paymongo_payment_method_id' => $paymentMethod['id'],
            ]);

            $attached = $this->payMongo->attachPaymentMethod(
                $resolvedAccount,
                $payment,
                $intent['id'],
                $paymentMethod['id'],
                $intent['clientKey'],
            );

            $payment->update([
                'paymongo_payment_id' => $attached['paymentId'],
                'provider_status' => $attached['status'],
            ]);
        } catch (PayMongoProviderException $exception) {
            $this->recordProviderFailure($payment, $exception);

            throw $exception;
        }

        return [
            'payment' => $payment->fresh(),
            'qrImageUrl' => $attached['qrImageUrl'],
        ];
    }

    /**
     * Resolve only the Business-selected verified tenant account with no fallback.
     */
    private function resolveAccount(Business $business): PayMongoAccount
    {
        try {
            return $this->accountResolver->resolve($business);
        } catch (RuntimeException) {
            throw new PaymentCreationException(
                'QR Ph payments are not configured for this business.',
                409,
            );
        }
    }

    /**
     * Lock and revalidate local authority, then persist one pending attempt.
     *
     * @return array{0: Payment, 1: int}
     */
    private function createLocalAttempt(
        Business $business,
        PhotoboothSession $session,
        PayMongoAccount $resolvedAccount,
    ): array {
        try {
            $result = DB::transaction(function () use (
                $business,
                $session,
                $resolvedAccount,
            ): array|PaymentCreationException {
                $lockedBusiness = Business::query()
                    ->whereKey($business->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                $lockedSession = PhotoboothSession::query()
                    ->whereKey($session->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                if ($lockedSession->business_id !== $lockedBusiness->id) {
                    return new PaymentCreationException(
                        'The payment session could not be found.',
                        404,
                    );
                }

                if (! in_array($lockedSession->status, [
                    PhotoboothSessionStatus::New,
                    PhotoboothSessionStatus::PaymentPending,
                ], true)) {
                    return new PaymentCreationException(
                        'A payment cannot be created for the current session state.',
                        409,
                    );
                }

                if ($lockedSession->isExpired()) {
                    $lockedSession->update([
                        'status' => PhotoboothSessionStatus::Expired,
                    ]);

                    return new PaymentCreationException(
                        'This session has expired.',
                        409,
                    );
                }

                $currentAccount = $this->resolveAccount($lockedBusiness);

                if ($currentAccount->id !== $resolvedAccount->id) {
                    return new PaymentCreationException(
                        'Payment configuration changed. Please retry.',
                        409,
                    );
                }

                if ($lockedSession->payments()
                    ->where('status', PaymentStatus::Success->value)
                    ->exists()) {
                    return new PaymentCreationException(
                        'This session already has a successful payment.',
                        409,
                    );
                }

                if ($lockedSession->payments()
                    ->where('status', PaymentStatus::Pending->value)
                    ->exists()) {
                    return new PaymentCreationException(
                        'A payment is already in progress for this session.',
                        409,
                    );
                }

                if ($lockedSession->price === null) {
                    return new PaymentCreationException(
                        'The session price snapshot is missing.',
                        409,
                    );
                }

                if ($lockedSession->currency !== 'PHP') {
                    return new PaymentCreationException(
                        'QR Ph requires a PHP session currency snapshot.',
                        409,
                    );
                }

                if ($lockedSession->expires_at === null) {
                    return new PaymentCreationException(
                        'The session expiration snapshot is missing.',
                        409,
                    );
                }

                $amount = (string) $lockedSession->price;
                $amountCentavos = $this->toCentavos($amount);

                $now = now();
                $remainingSeconds = $lockedSession->expires_at->getTimestamp()
                    - $now->getTimestamp();

                if ($remainingSeconds < self::MIN_QR_EXPIRY_SECONDS) {
                    return new PaymentCreationException(
                        'There is not enough session time remaining to create a QR Ph payment.',
                        409,
                    );
                }

                $providerExpiresAt = $now->copy()->addSeconds(
                    min($remainingSeconds, self::MAX_QR_EXPIRY_SECONDS),
                );

                if ($lockedSession->status === PhotoboothSessionStatus::New) {
                    $lockedSession->transitionTo(
                        PhotoboothSessionStatus::PaymentPending,
                    );
                }

                $lockedSession->update([
                    'payment_method' => PaymentMethod::PayMongoQrPh,
                ]);

                $payment = Payment::create([
                    'photobooth_session_id' => $lockedSession->id,
                    'paymongo_account_id' => $resolvedAccount->id,
                    'method' => PaymentMethod::PayMongoQrPh,
                    'status' => PaymentStatus::Pending,
                    'amount' => $amount,
                    'currency' => 'PHP',
                    'provider_idempotency_key' => 'thermasnap-payment-'.Str::uuid(),
                    'provider_status' => 'local_pending',
                    'provider_expires_at' => $providerExpiresAt,
                ]);

                return [
                    'payment' => $payment,
                    'amountCentavos' => $amountCentavos,
                ];
            });
        } catch (QueryException $exception) {
            $pendingExists = Payment::query()
                ->where('photobooth_session_id', $session->id)
                ->where('status', PaymentStatus::Pending->value)
                ->exists();

            if ($pendingExists) {
                throw new PaymentCreationException(
                    'A payment is already in progress for this session.',
                    409,
                );
            }

            throw $exception;
        }

        if ($result instanceof PaymentCreationException) {
            throw $result;
        }

        return [$result['payment'], $result['amountCentavos']];
    }

    /**
     * Convert decimal PHP money into integer centavos without floating point.
     */
    private function toCentavos(string $amount): int
    {
        $normalized = trim($amount);

        if (preg_match('/^\d+(?:\.\d{1,2})?$/D', $normalized) !== 1) {
            throw new PaymentCreationException(
                'The session price snapshot is invalid.',
                409,
            );
        }

        [$whole, $fraction] = array_pad(
            explode('.', $normalized, 2),
            2,
            '',
        );

        $fraction = str_pad($fraction, 2, '0');
        $centavos = ((int) $whole * 100) + (int) $fraction;

        if ($centavos < 100) {
            throw new PaymentCreationException(
                'The session price is below the PayMongo minimum.',
                409,
            );
        }

        return $centavos;
    }

    /**
     * Recalculate QR lifetime immediately before Payment Method creation.
     */
    private function remainingQrExpirySeconds(Payment $payment): int
    {
        if ($payment->provider_expires_at === null) {
            return 0;
        }

        return $payment->provider_expires_at->getTimestamp()
            - now()->getTimestamp();
    }

    /**
     * Terminalize an attempt if remote setup consumed the remaining QR window.
     */
    private function markExpiredBeforeQr(Payment $payment): void
    {
        DB::transaction(function () use ($payment): void {
            $lockedPayment = Payment::query()
                ->whereKey($payment->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedPayment->status !== PaymentStatus::Pending) {
                return;
            }

            $lockedPayment->update([
                'status' => PaymentStatus::Failed,
                'provider_status' => 'expired_before_qr',
                'failed_at' => now(),
            ]);
        });
    }

    /**
     * Preserve ambiguous attempts and terminalize only definitive provider failures.
     */
    private function recordProviderFailure(
        Payment $payment,
        PayMongoProviderException $exception,
    ): void {
        DB::transaction(function () use ($payment, $exception): void {
            $lockedPayment = Payment::query()
                ->whereKey($payment->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedPayment->status !== PaymentStatus::Pending) {
                return;
            }

            if ($exception->outcomeUncertain) {
                $lockedPayment->update([
                    'provider_status' => 'provider_uncertain',
                ]);

                return;
            }

            $lockedPayment->update([
                'status' => PaymentStatus::Failed,
                'provider_status' => 'creation_failed',
                'failed_at' => now(),
            ]);
        });
    }
}
