<?php

namespace App\Services\Payments;

use App\Enums\PayMongoMode;
use App\Models\PayMongoAccount;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class PayMongoWebhookProvisioner
{
    /**
     * Events required by the ThermaSnap QR Ph payment lifecycle.
     *
     * @var list<string>
     */
    private const EVENTS = [
        'payment.paid',
        'payment.failed',
        'qrph.expired',
    ];

    /**
     * Provision the first PayMongo webhook for a verified credential version.
     */
    public function provision(PayMongoAccount $account): void
    {
        try {
            $this->assertProvisionable($account);

            if (
                $this->hasWebhookId($account)
                || $this->hasWebhookSecret($account)
            ) {
                throw new RuntimeException(
                    'This PayMongo credential version already has webhook configuration.',
                );
            }

            $callbackUrl = $this->callbackUrl($account);

            $response = $this->send(
                $account,
                fn (PendingRequest $request): Response => $request
                    ->withHeaders([
                        'Idempotency-Key' => $this->idempotencyKey(
                            $account,
                            'create',
                        ),
                    ])
                    ->post('/v1/webhooks', [
                        'data' => [
                            'attributes' => [
                                'url' => $callbackUrl,
                                'events' => self::EVENTS,
                            ],
                        ],
                    ]),
            );

            $this->assertSuccessful(
                $response,
                'PayMongo webhook provisioning is temporarily unavailable.',
            );

            $resource = $this->webhookResource(
                $response,
                requireSecret: true,
            );

            $this->assertExpectedWebhook(
                $account,
                $resource,
                $callbackUrl,
            );

            if ($resource['status'] !== 'enabled') {
                throw new RuntimeException(
                    'PayMongo created the webhook in an unusable state.',
                );
            }

            $account
                ->forceFill([
                    'webhook_id' => $resource['id'],
                    'webhook_secret' => $resource['secret_key'],
                    'webhook_status' => $resource['status'],
                    'webhook_provisioned_at' => now(),
                ])
                ->save();

            $this->logResult(
                $account,
                'provisioned',
            );
        } catch (RuntimeException $exception) {
            $this->logResult(
                $account,
                'failed',
            );

            throw $exception;
        }
    }

    /**
     * Recover missing or disabled webhook configuration without replacing API credentials.
     */
    public function recover(PayMongoAccount $account): void
    {
        try {
            $this->assertProvisionable($account);

            $hasWebhookId = $this->hasWebhookId($account);
            $hasWebhookSecret = $this->hasWebhookSecret($account);

            if (! $hasWebhookId && ! $hasWebhookSecret) {
                $this->provision($account);

                return;
            }

            if ($hasWebhookId !== $hasWebhookSecret) {
                throw new RuntimeException(
                    'The stored PayMongo webhook configuration is incomplete. Replace this credential version instead of overwriting historical webhook secrets.',
                );
            }

            $callbackUrl = $this->callbackUrl($account);

            $response = $this->send(
                $account,
                fn (PendingRequest $request): Response => $request->get(
                    '/v1/webhooks/'.rawurlencode((string) $account->webhook_id),
                ),
            );

            if ($response->status() === 404) {
                throw new RuntimeException(
                    'The stored PayMongo webhook no longer exists remotely. Replace the credential version so the historical webhook secret remains preserved.',
                );
            }

            $this->assertSuccessful(
                $response,
                'Unable to recover the PayMongo webhook right now.',
            );

            $resource = $this->webhookResource($response);

            $this->assertWebhookBelongsToAccount(
                $account,
                $resource,
            );

            if (
                $resource['url'] !== $callbackUrl
                || ! $this->eventsMatch($resource['events'])
            ) {
                $response = $this->send(
                    $account,
                    fn (PendingRequest $request): Response => $request
                        ->withHeaders([
                            'Idempotency-Key' => $this->idempotencyKey(
                                $account,
                                'update',
                            ),
                        ])
                        ->put(
                            '/v1/webhooks/'.rawurlencode(
                                (string) $account->webhook_id,
                            ),
                            [
                                'data' => [
                                    'attributes' => [
                                        'url' => $callbackUrl,
                                        'events' => self::EVENTS,
                                    ],
                                ],
                            ],
                        ),
                );

                $this->assertSuccessful(
                    $response,
                    'Unable to update the PayMongo webhook right now.',
                );

                $resource = $this->webhookResource($response);

                $this->assertExpectedWebhook(
                    $account,
                    $resource,
                    $callbackUrl,
                );
            }

            if ($resource['status'] === 'disabled') {
                $response = $this->send(
                    $account,
                    fn (PendingRequest $request): Response => $request
                        ->withHeaders([
                            'Idempotency-Key' => $this->idempotencyKey(
                                $account,
                                'enable',
                            ),
                        ])
                        ->post(
                            '/v1/webhooks/'
                                .rawurlencode((string) $account->webhook_id)
                                .'/enable',
                        ),
                );

                $this->assertSuccessful(
                    $response,
                    'Unable to enable the PayMongo webhook right now.',
                );

                $resource = $this->webhookResource($response);

                $this->assertExpectedWebhook(
                    $account,
                    $resource,
                    $callbackUrl,
                );
            }

            if ($resource['status'] !== 'enabled') {
                throw new RuntimeException(
                    'The PayMongo webhook is not enabled.',
                );
            }

            $account
                ->forceFill([
                    'webhook_status' => 'enabled',
                    'webhook_provisioned_at' => now(),
                ])
                ->save();

            $this->logResult(
                $account,
                'recovered',
            );
        } catch (RuntimeException $exception) {
            $this->logResult(
                $account,
                'recovery_failed',
            );

            throw $exception;
        }
    }

    /**
     * Build the authenticated Laravel HTTP client for one tenant account.
     */
    private function client(PayMongoAccount $account): PendingRequest
    {
        return Http::baseUrl(
            (string) config(
                'services.paymongo.api_base_url',
                'https://api.paymongo.com',
            ),
        )
            ->withBasicAuth($account->secret_key, '')
            ->acceptJson()
            ->asJson()
            ->timeout(10);
    }

    /**
     * Execute a PayMongo request while mapping network failures to safe errors.
     *
     * @param  callable(PendingRequest): Response  $callback
     */
    private function send(
        PayMongoAccount $account,
        callable $callback,
    ): Response {
        try {
            return $callback($this->client($account));
        } catch (ConnectionException) {
            throw new RuntimeException(
                'Unable to reach PayMongo while managing the webhook.',
            );
        }
    }

    /**
     * Reject provider failures without exposing provider response bodies.
     */
    private function assertSuccessful(
        Response $response,
        string $temporaryFailureMessage,
    ): void {
        if (in_array($response->status(), [401, 403], true)) {
            throw new RuntimeException(
                'PayMongo rejected the tenant credentials while managing the webhook.',
            );
        }

        if ($response->failed()) {
            throw new RuntimeException($temporaryFailureMessage);
        }
    }

    /**
     * Normalize a PayMongo webhook resource using only expected safe fields.
     *
     * @return array{
     *     id: string,
     *     events: list<string>,
     *     livemode: bool,
     *     secret_key: string|null,
     *     status: string,
     *     url: string
     * }
     */
    private function webhookResource(
        Response $response,
        bool $requireSecret = false,
    ): array {
        $data = $response->json('data');

        if (
            ! is_array($data)
            || ($data['type'] ?? null) !== 'webhook'
            || ! is_string($data['id'] ?? null)
            || $data['id'] === ''
        ) {
            throw new RuntimeException(
                'PayMongo returned an invalid webhook response.',
            );
        }

        $attributes = $data['attributes'] ?? null;

        if (
            ! is_array($attributes)
            || ! is_array($attributes['events'] ?? null)
            || ! is_bool($attributes['livemode'] ?? null)
            || ! is_string($attributes['status'] ?? null)
            || ! is_string($attributes['url'] ?? null)
        ) {
            throw new RuntimeException(
                'PayMongo returned an invalid webhook response.',
            );
        }

        $events = [];

        foreach ($attributes['events'] as $event) {
            if (! is_string($event)) {
                throw new RuntimeException(
                    'PayMongo returned an invalid webhook response.',
                );
            }

            $events[] = $event;
        }

        $secretKey = $attributes['secret_key'] ?? null;

        if (
            $secretKey !== null
            && ! is_string($secretKey)
        ) {
            throw new RuntimeException(
                'PayMongo returned an invalid webhook response.',
            );
        }

        if (
            $requireSecret
            && (! is_string($secretKey) || $secretKey === '')
        ) {
            throw new RuntimeException(
                'PayMongo did not return a webhook verification secret.',
            );
        }

        return [
            'id' => $data['id'],
            'events' => $events,
            'livemode' => $attributes['livemode'],
            'secret_key' => $secretKey,
            'status' => $attributes['status'],
            'url' => $attributes['url'],
        ];
    }

    /**
     * Verify the provider resource belongs to the credential environment.
     *
     * @param array{
     *     id: string,
     *     events: list<string>,
     *     livemode: bool,
     *     secret_key: string|null,
     *     status: string,
     *     url: string
     * } $resource
     */
    private function assertWebhookBelongsToAccount(
        PayMongoAccount $account,
        array $resource,
    ): void {
        $expectedLiveMode = $account->mode === PayMongoMode::Live;

        if ($resource['livemode'] !== $expectedLiveMode) {
            throw new RuntimeException(
                'PayMongo returned a webhook from the wrong Test or Live environment.',
            );
        }

        if (
            $this->hasWebhookId($account)
            && $resource['id'] !== $account->webhook_id
        ) {
            throw new RuntimeException(
                'PayMongo returned an unexpected webhook resource.',
            );
        }
    }

    /**
     * Verify the provider resource has the exact required route and subscriptions.
     *
     * @param array{
     *     id: string,
     *     events: list<string>,
     *     livemode: bool,
     *     secret_key: string|null,
     *     status: string,
     *     url: string
     * } $resource
     */
    private function assertExpectedWebhook(
        PayMongoAccount $account,
        array $resource,
        string $callbackUrl,
    ): void {
        $this->assertWebhookBelongsToAccount(
            $account,
            $resource,
        );

        if ($resource['url'] !== $callbackUrl) {
            throw new RuntimeException(
                'PayMongo returned an unexpected webhook callback URL.',
            );
        }

        if (! $this->eventsMatch($resource['events'])) {
            throw new RuntimeException(
                'PayMongo returned unexpected webhook event subscriptions.',
            );
        }
    }

    /**
     * Determine whether the remote event set is exactly the ThermaSnap event set.
     *
     * @param  list<string>  $events
     */
    private function eventsMatch(array $events): bool
    {
        $expected = self::EVENTS;

        sort($expected);
        sort($events);

        return $events === $expected;
    }

    /**
     * Build the provider callback URL from trusted application configuration.
     */
    private function callbackUrl(PayMongoAccount $account): string
    {
        $baseUrl = rtrim(
            (string) config('app.url'),
            '/',
        );

        if ($baseUrl === '') {
            throw new RuntimeException(
                'The application URL is not configured for PayMongo webhooks.',
            );
        }

        $relativeRoute = route(
            'webhooks.paymongo',
            [
                'paymongoAccount' => $account->public_id,
            ],
            false,
        );

        $url = $baseUrl.'/'.ltrim($relativeRoute, '/');

        if (filter_var($url, FILTER_VALIDATE_URL) === false) {
            throw new RuntimeException(
                'The configured PayMongo webhook URL is invalid.',
            );
        }

        if ((string) config('app.env') === 'production') {
            $this->assertPublicProductionUrl($url);
        }

        return $url;
    }

    /**
     * Reject non-HTTPS, local, private, or reserved production callback URLs.
     */
    private function assertPublicProductionUrl(string $url): void
    {
        $scheme = strtolower(
            (string) parse_url($url, PHP_URL_SCHEME),
        );

        $host = strtolower(
            (string) parse_url($url, PHP_URL_HOST),
        );

        $user = parse_url($url, PHP_URL_USER);
        $password = parse_url($url, PHP_URL_PASS);

        if (
            $scheme !== 'https'
            || $host === ''
            || $user !== null
            || $password !== null
        ) {
            throw new RuntimeException(
                'Production PayMongo webhooks require a public HTTPS application URL.',
            );
        }

        if (
            $host === 'localhost'
            || str_ends_with($host, '.localhost')
            || str_ends_with($host, '.local')
            || str_ends_with($host, '.test')
            || str_ends_with($host, '.internal')
        ) {
            throw new RuntimeException(
                'Production PayMongo webhooks require a public HTTPS application URL.',
            );
        }

        $isIpAddress = filter_var(
            $host,
            FILTER_VALIDATE_IP,
        ) !== false;

        if (
            ! $isIpAddress
            && ! str_contains($host, '.')
        ) {
            throw new RuntimeException(
                'Production PayMongo webhooks require a public HTTPS application URL.',
            );
        }

        if (
            $isIpAddress
            && filter_var(
                $host,
                FILTER_VALIDATE_IP,
                FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE,
            ) === false
        ) {
            throw new RuntimeException(
                'Production PayMongo webhooks require a public HTTPS application URL.',
            );
        }
    }

    /**
     * Ensure the account may safely own a webhook.
     */
    private function assertProvisionable(PayMongoAccount $account): void
    {
        if (
            $account->verified_at === null
            || $account->superseded_at !== null
            || ! is_string($account->public_id)
            || $account->public_id === ''
        ) {
            throw new RuntimeException(
                'The PayMongo credential version is not eligible for webhook provisioning.',
            );
        }
    }

    /**
     * Determine whether a provider webhook identifier is stored.
     */
    private function hasWebhookId(PayMongoAccount $account): bool
    {
        return is_string($account->webhook_id)
            && $account->webhook_id !== '';
    }

    /**
     * Determine whether an encrypted webhook verification secret is stored.
     */
    private function hasWebhookSecret(PayMongoAccount $account): bool
    {
        return is_string($account->webhook_secret)
            && $account->webhook_secret !== '';
    }

    /**
     * Build a stable provider idempotency key without containing credentials.
     */
    private function idempotencyKey(
        PayMongoAccount $account,
        string $operation,
    ): string {
        return 'thermasnap-paymongo-webhook-'
            .$operation
            .'-'
            .$account->public_id;
    }

    /**
     * Record only non-secret operational webhook evidence.
     */
    private function logResult(
        PayMongoAccount $account,
        string $result,
    ): void {
        Log::info('PayMongo webhook provisioning result.', [
            'business_id' => $account->business_id,
            'paymongo_account_public_id' => $account->public_id,
            'mode' => $account->mode->value,
            'webhook_id' => $account->webhook_id,
            'result' => $result,
        ]);
    }
}
