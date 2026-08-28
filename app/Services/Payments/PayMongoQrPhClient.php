<?php

namespace App\Services\Payments;

use App\Exceptions\PayMongoProviderException;
use App\Models\Payment;
use App\Models\PayMongoAccount;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use LogicException;
use Throwable;

class PayMongoQrPhClient
{
    /**
     * Create the server-owned Payment Intent using the tenant secret key.
     *
     * @return array{id: string, clientKey: string, status: string}
     */
    public function createPaymentIntent(
        PayMongoAccount $account,
        Payment $payment,
        int $amountCentavos,
    ): array {
        $response = $this->post(
            $account->secret_key,
            '/v1/payment_intents',
            [
                'data' => [
                    'attributes' => [
                        'amount' => $amountCentavos,
                        'currency' => $payment->currency,
                        'payment_method_allowed' => ['qrph'],
                    ],
                ],
            ],
            $this->idempotencyKey($payment, 'intent'),
        );

        return [
            'id' => $this->requiredString($response, 'data.id'),
            'clientKey' => $this->requiredString(
                $response,
                'data.attributes.client_key',
            ),
            'status' => $this->requiredString(
                $response,
                'data.attributes.status',
            ),
        ];
    }

    /**
     * Create the QR Ph Payment Method using the tenant public key.
     *
     * @return array{id: string}
     */
    public function createPaymentMethod(
        PayMongoAccount $account,
        Payment $payment,
        int $expirySeconds,
    ): array {
        $response = $this->post(
            $account->public_key,
            '/v1/payment_methods',
            [
                'data' => [
                    'attributes' => [
                        'type' => 'qrph',
                        'expiry_seconds' => $expirySeconds,
                    ],
                ],
            ],
            $this->idempotencyKey($payment, 'method'),
        );

        return [
            'id' => $this->requiredString($response, 'data.id'),
        ];
    }

    /**
     * Attach the QR Ph method using the tenant public key and transient client key.
     *
     * @return array{status: string, qrImageUrl: string, paymentId: string|null}
     */
    public function attachPaymentMethod(
        PayMongoAccount $account,
        Payment $payment,
        string $paymentIntentId,
        string $paymentMethodId,
        string $clientKey,
    ): array {
        $response = $this->post(
            $account->public_key,
            "/v1/payment_intents/{$paymentIntentId}/attach",
            [
                'data' => [
                    'attributes' => [
                        'payment_method' => $paymentMethodId,
                        'client_key' => $clientKey,
                    ],
                ],
            ],
            $this->idempotencyKey($payment, 'attach'),
        );

        $qrImageUrl = $this->requiredString(
            $response,
            'data.attributes.next_action.code.image_url',
        );

        if (
            ! str_starts_with($qrImageUrl, 'data:image/')
            || ! str_contains($qrImageUrl, ';base64,')
        ) {
            throw PayMongoProviderException::uncertain();
        }

        return [
            'status' => $this->requiredString(
                $response,
                'data.attributes.status',
            ),
            'qrImageUrl' => $qrImageUrl,
            'paymentId' => $this->optionalString(
                $response,
                'data.attributes.payments.0.id',
            ),
        ];
    }

    /**
     * Build a tenant-key authenticated HTTP client with the repository retry policy.
     */
    private function client(string $apiKey): PendingRequest
    {
        return Http::baseUrl(
            (string) config(
                'services.paymongo.api_base_url',
                'https://api.paymongo.com',
            ),
        )
            ->withBasicAuth($apiKey, '')
            ->acceptJson()
            ->asJson()
            ->retry(
                [100, 200],
                0,
                function (Throwable $exception): bool {
                    return $exception instanceof ConnectionException
                        || ($exception instanceof RequestException
                            && $exception->response->serverError());
                },
                throw: false,
            )
            ->connectTimeout(5)
            ->timeout(10);
    }

    /**
     * Execute one idempotent PayMongo POST and classify safe failure semantics.
     *
     * @param  array<string, mixed>  $payload
     */
    private function post(
        string $apiKey,
        string $path,
        array $payload,
        string $idempotencyKey,
    ): Response {
        try {
            $response = $this->client($apiKey)
                ->withHeader('Idempotency-Key', $idempotencyKey)
                ->post($path, $payload);
        } catch (ConnectionException) {
            throw PayMongoProviderException::uncertain();
        }

        if ($response->serverError()) {
            throw PayMongoProviderException::uncertain();
        }

        if ($response->clientError()) {
            throw PayMongoProviderException::definitive();
        }

        if (! $response->successful()) {
            throw PayMongoProviderException::uncertain();
        }

        return $response;
    }

    /**
     * Derive a stable operation-specific key from the durable local attempt key.
     */
    private function idempotencyKey(
        Payment $payment,
        string $operation,
    ): string {
        if (
            $payment->provider_idempotency_key === null
            || $payment->provider_idempotency_key === ''
        ) {
            throw new LogicException(
                'A PayMongo payment attempt requires an idempotency key.',
            );
        }

        return "{$payment->provider_idempotency_key}-{$operation}";
    }

    /**
     * Read a required non-empty string from a successful provider response.
     */
    private function requiredString(Response $response, string $path): string
    {
        $value = $response->json($path);

        if (! is_string($value) || $value === '') {
            throw PayMongoProviderException::uncertain();
        }

        return $value;
    }

    /**
     * Read an optional non-empty provider identifier from a response.
     */
    private function optionalString(
        Response $response,
        string $path,
    ): ?string {
        $value = $response->json($path);

        return is_string($value) && $value !== ''
            ? $value
            : null;
    }
}
