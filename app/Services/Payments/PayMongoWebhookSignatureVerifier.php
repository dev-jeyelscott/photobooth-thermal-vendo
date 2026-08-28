<?php

namespace App\Services\Payments;

use App\Enums\PayMongoMode;
use App\Models\PayMongoAccount;

class PayMongoWebhookSignatureVerifier
{
    /**
     * Verify a PayMongo `Paymongo-Signature` header against the raw webhook body.
     */
    public function verify(
        PayMongoAccount $account,
        string $rawBody,
        ?string $signatureHeader,
    ): bool {
        if ($signatureHeader === null || $signatureHeader === '') {
            return false;
        }

        $webhookSecret = $account->webhook_secret;

        if (! is_string($webhookSecret) || $webhookSecret === '') {
            return false;
        }

        $fields = $this->parseSignatureHeader($signatureHeader);

        if ($fields === null) {
            return false;
        }

        [$timestamp, $testSignature, $liveSignature] = $fields;

        $tolerance = (int) config(
            'services.paymongo.webhook_tolerance_seconds',
            300,
        );

        if (abs(now()->getTimestamp() - $timestamp) > $tolerance) {
            return false;
        }

        $providedSignature = $account->mode === PayMongoMode::Live
            ? $liveSignature
            : $testSignature;

        if ($providedSignature === '') {
            return false;
        }

        $expectedSignature = hash_hmac(
            'sha256',
            $timestamp.'.'.$rawBody,
            $webhookSecret,
        );

        return hash_equals($expectedSignature, $providedSignature);
    }

    /**
     * Parse the `t=...,te=...,li=...` webhook signature header into its components.
     *
     * @return array{0: int, 1: string, 2: string}|null
     */
    private function parseSignatureHeader(string $header): ?array
    {
        $timestamp = null;
        $testSignature = '';
        $liveSignature = '';

        foreach (explode(',', $header) as $part) {
            [$key, $value] = array_pad(explode('=', $part, 2), 2, '');

            match ($key) {
                't' => $timestamp = $value,
                'te' => $testSignature = $value,
                'li' => $liveSignature = $value,
                default => null,
            };
        }

        if (
            $timestamp === null
            || $timestamp === ''
            || ! ctype_digit($timestamp)
        ) {
            return null;
        }

        return [(int) $timestamp, $testSignature, $liveSignature];
    }
}
