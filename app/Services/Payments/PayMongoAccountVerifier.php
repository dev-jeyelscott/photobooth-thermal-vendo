<?php

namespace App\Services\Payments;

use App\Enums\PayMongoMode;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class PayMongoAccountVerifier
{
    /**
     * Verify mode-correct credentials and required QR Ph capability.
     */
    public function verify(
        PayMongoMode $mode,
        string $publicKey,
        string $secretKey,
    ): void {
        if (! str_starts_with($publicKey, $mode->publicKeyPrefix())) {
            throw new RuntimeException(
                'The PayMongo public key does not match the selected mode.',
            );
        }

        if (! str_starts_with($secretKey, $mode->secretKeyPrefix())) {
            throw new RuntimeException(
                'The PayMongo secret key does not match the selected mode.',
            );
        }

        try {
            $response = Http::baseUrl(
                (string) config(
                    'services.paymongo.api_base_url',
                    'https://api.paymongo.com',
                ),
            )
                ->withBasicAuth($secretKey, '')
                ->acceptJson()
                ->timeout(10)
                ->get('/v1/merchants/capabilities/payment_methods');
        } catch (ConnectionException) {
            throw new RuntimeException(
                'Unable to verify PayMongo credentials right now.',
            );
        }

        if (in_array($response->status(), [401, 403], true)) {
            throw new RuntimeException(
                'PayMongo rejected the supplied credentials.',
            );
        }

        if ($response->failed()) {
            throw new RuntimeException(
                'PayMongo credential verification is temporarily unavailable.',
            );
        }

        $paymentMethods = $response->json();

        if (
            ! is_array($paymentMethods)
            || ! in_array('qrph', $paymentMethods, true)
        ) {
            throw new RuntimeException(
                'QR Ph is not enabled for this PayMongo account.',
            );
        }
    }
}
