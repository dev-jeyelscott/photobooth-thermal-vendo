<?php

namespace App\Services\Payments;

use App\Enums\PayMongoMode;
use App\Models\PayMongoAccount;

class PayMongoWebhookSignatureVerifier
{
    /**
     * Verify the exact raw PayMongo webhook body against the historical
     * account-specific webhook signing secret.
     */
    public function verify(
        PayMongoAccount $account,
        string $rawBody,
        ?string $signatureHeader,
    ): bool {
        if (
            $rawBody === ''
            || ! is_string($account->webhook_secret)
            || $account->webhook_secret === ''
            || ! is_string($signatureHeader)
            || $signatureHeader === ''
        ) {
            return false;
        }

        $parts = $this->parseHeader($signatureHeader);

        if ($parts === null) {
            return false;
        }

        $tolerance = max(
            1,
            (int) config(
                'services.paymongo.webhook_tolerance_seconds',
                300,
            ),
        );

        if (
            abs(now()->getTimestamp() - $parts['t'])
            > $tolerance
        ) {
            return false;
        }

        $providedSignature = match ($account->mode) {
            PayMongoMode::Test => $parts['te'],
            PayMongoMode::Live => $parts['li'],
        };

        $crossModeSignature = match ($account->mode) {
            PayMongoMode::Test => $parts['li'],
            PayMongoMode::Live => $parts['te'],
        };

        if (
            ! $this->isSha256Hex($providedSignature)
            || $crossModeSignature !== ''
        ) {
            return false;
        }

        $expectedSignature = hash_hmac(
            'sha256',
            $parts['t'].'.'.$rawBody,
            $account->webhook_secret,
        );

        return hash_equals(
            $expectedSignature,
            strtolower($providedSignature),
        );
    }

    /**
     * Parse the exact t, te, and li fields while rejecting malformed or
     * duplicate components.
     *
     * @return array{t: int, te: string, li: string}|null
     */
    private function parseHeader(string $header): ?array
    {
        $parsed = [];

        foreach (explode(',', $header) as $segment) {
            $segment = trim($segment);

            if (
                $segment === ''
                || ! str_contains($segment, '=')
            ) {
                return null;
            }

            [$key, $value] = explode('=', $segment, 2);

            $key = trim($key);
            $value = trim($value);

            if (
                ! in_array($key, ['t', 'te', 'li'], true)
                || array_key_exists($key, $parsed)
            ) {
                return null;
            }

            $parsed[$key] = $value;
        }

        if (
            ! array_key_exists('t', $parsed)
            || ! array_key_exists('te', $parsed)
            || ! array_key_exists('li', $parsed)
            || ! ctype_digit($parsed['t'])
        ) {
            return null;
        }

        $timestamp = (int) $parsed['t'];

        if ($timestamp < 1) {
            return null;
        }

        return [
            't' => $timestamp,
            'te' => $parsed['te'],
            'li' => $parsed['li'],
        ];
    }

    /**
     * Determine whether a value is one complete SHA-256 hexadecimal digest.
     */
    private function isSha256Hex(string $signature): bool
    {
        return strlen($signature) === 64
            && ctype_xdigit($signature);
    }
}
