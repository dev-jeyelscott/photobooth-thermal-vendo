<?php

namespace App\Actions\Payments;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Models\Payment;
use App\Services\Payments\PayMongoPaymentStateApplier;
use App\Services\Payments\PayMongoQrPhClient;
use RuntimeException;

class ReconcilePayMongoPayment
{
    /**
     * Create the provider reconciliation action.
     */
    public function __construct(
        private readonly PayMongoQrPhClient $payMongo,
        private readonly PayMongoPaymentStateApplier $stateApplier,
    ) {}

    /**
     * Retrieve and reconcile one pending Payment Intent through its historical account version.
     */
    public function handle(Payment $payment): void
    {
        if (
            $payment->method !== PaymentMethod::PayMongoQrPh
            || $payment->status !== PaymentStatus::Pending
            || $payment->paymongo_account_id === null
            || $payment->paymongo_payment_intent_id === null
        ) {
            return;
        }

        $account = $payment->payMongoAccount()->firstOrFail();

        $intent = $this->payMongo->retrievePaymentIntent(
            $account,
            $payment->paymongo_payment_intent_id,
        );

        if ($intent['id'] !== $payment->paymongo_payment_intent_id) {
            throw new RuntimeException(
                'Reconciled PayMongo Payment Intent identity mismatch.',
            );
        }

        if ($intent['status'] === 'succeeded') {
            if ($intent['paymentId'] === null) {
                throw new RuntimeException(
                    'Succeeded PayMongo Payment Intent has no payment identifier.',
                );
            }

            $this->stateApplier->applyPaid(
                $payment,
                $account->id,
                $intent['id'],
                $intent['paymentId'],
                $intent['amount'],
                strtoupper($intent['currency']),
                $intent['livemode'],
                'reconciled:succeeded',
            );

            return;
        }

        if (
            $intent['status'] === 'awaiting_payment_method'
            && $payment->provider_expires_at?->isPast()
        ) {
            $this->stateApplier->applyExpired(
                $payment,
                $account->id,
                $intent['livemode'],
                'reconciled:awaiting_payment_method',
                $payment->paymongo_payment_method_id,
                $intent['id'],
            );

            return;
        }

        if (
            in_array(
                $intent['status'],
                [
                    'awaiting_payment_method',
                    'awaiting_next_action',
                    'processing',
                ],
                true,
            )
        ) {
            $this->stateApplier->recordPendingProviderStatus(
                $payment,
                $account->id,
                $intent['livemode'],
                'reconciled:'.$intent['status'],
            );

            return;
        }

        throw new RuntimeException(
            'Unsupported reconciled PayMongo Payment Intent status.',
        );
    }
}
