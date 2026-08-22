<?php

namespace App\Actions\Payments;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Models\ApplicationSetting;
use App\Models\Payment;
use App\Models\PhotoboothSession;
use App\Services\Settings;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class CreateMayaCheckout
{
    /**
     * Create a Maya checkout session for the given photobooth session and persist a pending Payment.
     *
     * @return array{payment: Payment, checkoutUrl: string}
     */
    public function handle(PhotoboothSession $session): array
    {
        $amount = $session->price !== null ? (string) $session->price : $this->resolveSessionPrice();
        $currency = $session->currency ?? (string) Settings::get('currency');
        $referenceNumber = (string) Str::uuid();

        $response = Http::baseUrl(config('services.maya.base_url'))
            ->withBasicAuth((string) config('services.maya.secret_key'), '')
            ->acceptJson()
            ->post('/checkout/v1/checkouts', [
                'totalAmount' => [
                    'value' => $amount,
                    'currency' => $currency,
                ],
                'requestReferenceNumber' => $referenceNumber,
                'redirectUrl' => [
                    'success' => route('kiosk.sessions.show', $session->session_token),
                    'failure' => route('kiosk.sessions.show', $session->session_token),
                    'cancel' => route('kiosk.sessions.show', $session->session_token),
                ],
            ]);

        if ($response->failed()) {
            throw new RuntimeException('Failed to create Maya checkout session.');
        }

        $checkoutId = $response->json('checkoutId');

        $payment = DB::transaction(function () use ($session, $amount, $currency, $checkoutId): Payment {
            $lockedSession = PhotoboothSession::whereKey($session->id)->lockForUpdate()->first();

            $hasActivePayment = $lockedSession->payment()
                ->whereNotIn('status', [PaymentStatus::Failed, PaymentStatus::Cancelled])
                ->exists();

            if ($hasActivePayment) {
                throw new RuntimeException('A payment is already in progress for this session.');
            }

            $payment = Payment::create([
                'photobooth_session_id' => $lockedSession->id,
                'method' => PaymentMethod::Maya,
                'status' => PaymentStatus::Pending,
                'maya_checkout_id' => $checkoutId,
                'amount' => $amount,
            ]);

            if ($lockedSession->price === null) {
                $lockedSession->update([
                    'price' => $amount,
                    'currency' => $currency,
                    'payment_method' => PaymentMethod::Maya,
                    'required_capture_count' => Settings::get('capture_shot_count'),
                ]);
            }

            return $payment;
        });

        return [
            'payment' => $payment,
            'checkoutUrl' => $response->json('redirectUrl'),
        ];
    }

    /**
     * Resolve the current session price from application settings.
     */
    private function resolveSessionPrice(): string
    {
        $setting = ApplicationSetting::where('key', 'session_price')->first();

        if ($setting === null || $setting->value === null) {
            throw new RuntimeException('Session pricing has not been configured.');
        }

        return $setting->value;
    }
}
