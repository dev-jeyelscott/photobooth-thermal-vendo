<?php

namespace App\Actions\Payments;

use App\Enums\PaymentMethod;
use App\Enums\PayMongoMode;
use App\Models\Payment;
use App\Models\PayMongoWebhookEvent;
use App\Services\Payments\PayMongoPaymentStateApplier;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class ProcessPayMongoWebhookEvent
{
    /**
     * Create the queued webhook processing action.
     */
    public function __construct(
        private readonly PayMongoPaymentStateApplier $stateApplier,
    ) {}

    /**
     * Process one durable webhook inbox record idempotently.
     */
    public function handle(PayMongoWebhookEvent $webhookEvent): void
    {
        DB::transaction(function () use ($webhookEvent): void {
            $event = PayMongoWebhookEvent::query()
                ->whereKey($webhookEvent->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($event->processed_at !== null) {
                return;
            }

            $account = $event->payMongoAccount()->firstOrFail();

            $expectedLivemode = $account->mode === PayMongoMode::Live;

            if ($event->livemode !== $expectedLivemode) {
                throw new RuntimeException(
                    'PayMongo webhook account mode mismatch.',
                );
            }

            $payloadEventType = data_get(
                $event->payload,
                'data.attributes.type',
            );

            $payloadLivemode = data_get(
                $event->payload,
                'data.attributes.livemode',
            );

            if (
                ! is_string($payloadEventType)
                || $payloadEventType !== $event->event_type
                || ! is_bool($payloadLivemode)
                || $payloadLivemode !== $event->livemode
            ) {
                throw new RuntimeException(
                    'PayMongo webhook envelope mismatch.',
                );
            }

            match ($event->event_type) {
                'payment.paid' => $this->processPaymentEvent(
                    $event,
                    true,
                ),
                'payment.failed' => $this->processPaymentEvent(
                    $event,
                    false,
                ),
                'qrph.expired' => $this->processExpiredEvent($event),
                default => $this->recordUnsupportedEvent($event),
            };

            $event->update([
                'processed_at' => now(),
                'failed_at' => null,
                'last_error' => null,
            ]);
        });
    }

    /**
     * Process payment.paid or payment.failed using exact provider and financial evidence.
     */
    private function processPaymentEvent(
        PayMongoWebhookEvent $event,
        bool $paid,
    ): void {
        $resource = data_get(
            $event->payload,
            'data.attributes.data',
        );

        if (! is_array($resource)) {
            throw new RuntimeException(
                'PayMongo payment event resource is malformed.',
            );
        }

        $paymentId = data_get($resource, 'id');
        $resourceType = data_get($resource, 'type');
        $paymentIntentId = data_get(
            $resource,
            'attributes.payment_intent_id',
        );
        $amount = data_get($resource, 'attributes.amount');
        $currency = data_get($resource, 'attributes.currency');
        $providerPaymentStatus = data_get(
            $resource,
            'attributes.status',
        );
        $resourceLivemode = data_get(
            $resource,
            'attributes.livemode',
        );

        if (
            ! is_string($paymentId)
            || $paymentId === ''
            || $resourceType !== 'payment'
            || ! is_string($paymentIntentId)
            || $paymentIntentId === ''
            || ! is_int($amount)
            || $amount < 1
            || ! is_string($currency)
            || strlen($currency) !== 3
            || ! is_string($providerPaymentStatus)
        ) {
            throw new RuntimeException(
                'PayMongo payment event evidence is malformed.',
            );
        }

        if (
            $resourceLivemode !== null
            && (
                ! is_bool($resourceLivemode)
                || $resourceLivemode !== $event->livemode
            )
        ) {
            throw new RuntimeException(
                'PayMongo payment resource mode mismatch.',
            );
        }

        $expectedProviderStatus = $paid ? 'paid' : 'failed';

        if ($providerPaymentStatus !== $expectedProviderStatus) {
            throw new RuntimeException(
                'PayMongo payment resource status mismatch.',
            );
        }

        $payment = $this->findUniquePayment(
            $event->paymongo_account_id,
            $paymentId,
            $paymentIntentId,
        );

        if ($paid) {
            $this->stateApplier->applyPaid(
                $payment,
                $event->paymongo_account_id,
                $paymentIntentId,
                $paymentId,
                $amount,
                strtoupper($currency),
                $event->livemode,
                'payment.paid',
            );

            return;
        }

        $this->stateApplier->applyFailed(
            $payment,
            $event->paymongo_account_id,
            $paymentIntentId,
            $paymentId,
            $amount,
            strtoupper($currency),
            $event->livemode,
            'payment.failed',
        );
    }

    /**
     * Process qrph.expired only through exact locally stored provider resource identity.
     */
    private function processExpiredEvent(
        PayMongoWebhookEvent $event,
    ): void {
        $resource = data_get(
            $event->payload,
            'data.attributes.data',
        );

        if (! is_array($resource)) {
            throw new RuntimeException(
                'PayMongo QR Ph expiry resource is malformed.',
            );
        }

        $resourceId = data_get($resource, 'id');
        $paymentIntentId = data_get(
            $resource,
            'attributes.payment_intent_id',
        );
        $resourceLivemode = data_get(
            $resource,
            'attributes.livemode',
        );

        if (! is_string($resourceId) || $resourceId === '') {
            throw new RuntimeException(
                'PayMongo QR Ph expiry resource identifier is missing.',
            );
        }

        if (
            $paymentIntentId !== null
            && ! is_string($paymentIntentId)
        ) {
            throw new RuntimeException(
                'PayMongo QR Ph expiry intent identifier is malformed.',
            );
        }

        if (
            $resourceLivemode !== null
            && (
                ! is_bool($resourceLivemode)
                || $resourceLivemode !== $event->livemode
            )
        ) {
            throw new RuntimeException(
                'PayMongo QR Ph expiry mode mismatch.',
            );
        }

        $payment = $this->findUniqueExpiryPayment(
            $event->paymongo_account_id,
            $resourceId,
            $paymentIntentId,
        );

        $matchedPaymentMethodId =
            $payment->paymongo_payment_method_id === $resourceId
                ? $resourceId
                : null;

        $matchedPaymentIntentId =
            is_string($paymentIntentId)
            && $payment->paymongo_payment_intent_id === $paymentIntentId
                ? $paymentIntentId
                : null;

        $this->stateApplier->applyExpired(
            $payment,
            $event->paymongo_account_id,
            $event->livemode,
            'qrph.expired',
            $matchedPaymentMethodId,
            $matchedPaymentIntentId,
        );
    }

    /**
     * Find exactly one local Payment using the webhook account and stored provider IDs.
     */
    private function findUniquePayment(
        int $paymongoAccountId,
        string $paymentId,
        string $paymentIntentId,
    ): Payment {
        $payments = Payment::query()
            ->where('paymongo_account_id', $paymongoAccountId)
            ->where('method', PaymentMethod::PayMongoQrPh)
            ->where(function ($query) use (
                $paymentId,
                $paymentIntentId,
            ): void {
                $query
                    ->where(
                        'paymongo_payment_id',
                        $paymentId,
                    )
                    ->orWhere(
                        'paymongo_payment_intent_id',
                        $paymentIntentId,
                    );
            })
            ->limit(2)
            ->get();

        return $this->onlyPayment($payments);
    }

    /**
     * Find exactly one local Payment for QR expiry without guessing undocumented resource fields.
     */
    private function findUniqueExpiryPayment(
        int $paymongoAccountId,
        string $resourceId,
        ?string $paymentIntentId,
    ): Payment {
        $payments = Payment::query()
            ->where('paymongo_account_id', $paymongoAccountId)
            ->where('method', PaymentMethod::PayMongoQrPh)
            ->where(function ($query) use (
                $resourceId,
                $paymentIntentId,
            ): void {
                $query->where(
                    'paymongo_payment_method_id',
                    $resourceId,
                );

                if (
                    is_string($paymentIntentId)
                    && $paymentIntentId !== ''
                ) {
                    $query->orWhere(
                        'paymongo_payment_intent_id',
                        $paymentIntentId,
                    );
                }
            })
            ->limit(2)
            ->get();

        return $this->onlyPayment($payments);
    }

    /**
     * Require provider evidence to resolve to exactly one local Payment.
     *
     * @param Collection<int, Payment> $payments
     */
    private function onlyPayment(Collection $payments): Payment
    {
        if ($payments->count() !== 1) {
            throw new RuntimeException(
                'PayMongo webhook could not be uniquely matched to a local payment.',
            );
        }

        return $payments->firstOrFail();
    }

    /**
     * Safely acknowledge an authenticated event outside the currently subscribed event contract.
     */
    private function recordUnsupportedEvent(
        PayMongoWebhookEvent $event,
    ): void {
        Log::notice('Verified unsupported PayMongo webhook event ignored.', [
            'paymongo_webhook_event_id' => $event->id,
            'paymongo_account_id' => $event->paymongo_account_id,
            'provider_event_id' => $event->provider_event_id,
            'event_type' => $event->event_type,
        ]);
    }
}
