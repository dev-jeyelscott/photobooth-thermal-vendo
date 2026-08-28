<?php

use App\Enums\PayMongoMode;
use App\Models\Business;
use App\Models\PayMongoAccount;
use App\Models\User;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Build the expected PayMongo callback URL for an account.
 */
function expectedPayMongoCallbackUrl(PayMongoAccount $account): string
{
    return rtrim((string) config('app.url'), '/')
        .route(
            'webhooks.paymongo',
            ['paymongoAccount' => $account->public_id],
            false,
        );
}

/**
 * Build a fake PayMongo webhook resource.
 *
 * @param  list<string>  $events
 * @return array<string, mixed>
 */
function fakePayMongoWebhookResource(
    string $id,
    string $url,
    array $events,
    bool $livemode,
    string $status = 'enabled',
    ?string $secret = null,
): array {
    $attributes = [
        'events' => $events,
        'livemode' => $livemode,
        'status' => $status,
        'url' => $url,
        'created_at' => now()->timestamp,
        'updated_at' => now()->timestamp,
    ];

    if ($secret !== null) {
        $attributes['secret_key'] = $secret;
    }

    return [
        'data' => [
            'id' => $id,
            'type' => 'webhook',
            'attributes' => $attributes,
        ],
    ];
}

test('replacement provisions the exact required webhook before selecting the account', function () {
    config()->set('app.url', 'https://thermasnap.example.com');

    Http::preventStrayRequests();

    $publicKey = 'pk_test_tenant-public-1234';
    $secretKey = 'sk_test_tenant-secret-5678';
    $webhookSecret = 'whsk_tenant-webhook-9012';

    Http::fake(function (HttpRequest $request) use ($webhookSecret) {
        if (
            $request->url()
            === 'https://api.paymongo.com/v1/merchants/capabilities/payment_methods'
        ) {
            return Http::response(['qrph']);
        }

        if (
            $request->url() === 'https://api.paymongo.com/v1/webhooks'
            && $request->method() === 'POST'
        ) {
            $attributes = $request->data()['data']['attributes'];

            return Http::response(
                fakePayMongoWebhookResource(
                    'hook_test_123',
                    $attributes['url'],
                    $attributes['events'],
                    false,
                    'enabled',
                    $webhookSecret,
                ),
            );
        }

        return Http::response([], 404);
    });

    $business = Business::factory()->create();

    $this
        ->actingAs($business->owner)
        ->withSession([
            'auth.password_confirmed_at' => time(),
        ])
        ->put(
            route('admin.payment-settings.replace', [
                'mode' => 'test',
            ]),
            [
                'public_key' => $publicKey,
                'secret_key' => $secretKey,
            ],
        )
        ->assertRedirect(route('admin.payment-settings.edit'));

    $account = PayMongoAccount::query()->firstOrFail();

    expect($account->public_id)
        ->not->toBeEmpty()
        ->and($account->webhook_id)
        ->toBe('hook_test_123')
        ->and($account->webhook_secret)
        ->toBe($webhookSecret)
        ->and($account->webhook_status)
        ->toBe('enabled')
        ->and($account->webhook_provisioned_at)
        ->not->toBeNull()
        ->and($account->isReadyForPayments())
        ->toBeTrue()
        ->and($business->fresh()->test_paymongo_account_id)
        ->toBe($account->id);

    $rawAccount = DB::table('paymongo_accounts')
        ->where('id', $account->id)
        ->first();

    expect((string) $rawAccount->webhook_secret)
        ->not->toBe($webhookSecret)
        ->and((string) $rawAccount->webhook_secret)
        ->not->toContain('whsk_');

    Http::assertSent(function (HttpRequest $request) use (
        $account,
        $secretKey,
    ): bool {
        if (
            $request->url() !== 'https://api.paymongo.com/v1/webhooks'
            || $request->method() !== 'POST'
        ) {
            return false;
        }

        $attributes = $request->data()['data']['attributes'] ?? [];

        return $request->hasHeader(
            'Authorization',
            'Basic '.base64_encode($secretKey.':'),
        )
            && $request->hasHeader(
                'Idempotency-Key',
                'thermasnap-paymongo-webhook-create-'.$account->public_id,
            )
            && ($attributes['events'] ?? null) === [
                'payment.paid',
                'payment.failed',
                'qrph.expired',
            ]
            && ($attributes['url'] ?? null)
                === expectedPayMongoCallbackUrl($account);
    });
});

test('test and live credentials receive isolated webhook resources', function () {
    config()->set('app.url', 'https://thermasnap.example.com');

    Http::preventStrayRequests();

    $testSecretKey = 'sk_test_isolated-secret-1111';
    $liveSecretKey = 'sk_live_isolated-secret-2222';

    Http::fake(function (HttpRequest $request) use (

        $liveSecretKey,
    ) {
        if (
            $request->url()
            === 'https://api.paymongo.com/v1/merchants/capabilities/payment_methods'
        ) {
            return Http::response(['qrph']);
        }

        if (
            $request->url() === 'https://api.paymongo.com/v1/webhooks'
            && $request->method() === 'POST'
        ) {
            $attributes = $request->data()['data']['attributes'];

            $isLive = $request->hasHeader(
                'Authorization',
                'Basic '.base64_encode($liveSecretKey.':'),
            );

            return Http::response(
                fakePayMongoWebhookResource(
                    $isLive ? 'hook_live_222' : 'hook_test_111',
                    $attributes['url'],
                    $attributes['events'],
                    $isLive,
                    'enabled',
                    $isLive
                        ? 'whsk_live_2222'
                        : 'whsk_test_1111',
                ),
            );
        }

        return Http::response([], 404);
    });

    $business = Business::factory()->create();

    $this
        ->actingAs($business->owner)
        ->withSession([
            'auth.password_confirmed_at' => time(),
        ])
        ->put(
            route('admin.payment-settings.replace', [
                'mode' => 'test',
            ]),
            [
                'public_key' => 'pk_test_isolated-public-1111',
                'secret_key' => $testSecretKey,
            ],
        )
        ->assertRedirect(route('admin.payment-settings.edit'));

    $this
        ->actingAs($business->owner)
        ->withSession([
            'auth.password_confirmed_at' => time(),
        ])
        ->put(
            route('admin.payment-settings.replace', [
                'mode' => 'live',
            ]),
            [
                'public_key' => 'pk_live_isolated-public-2222',
                'secret_key' => $liveSecretKey,
            ],
        )
        ->assertRedirect(route('admin.payment-settings.edit'));

    $business->refresh();

    $testAccount = PayMongoAccount::query()
        ->findOrFail($business->test_paymongo_account_id);

    $liveAccount = PayMongoAccount::query()
        ->findOrFail($business->live_paymongo_account_id);

    expect($testAccount->mode)
        ->toBe(PayMongoMode::Test)
        ->and($testAccount->webhook_id)
        ->toBe('hook_test_111')
        ->and($testAccount->webhook_secret)
        ->toBe('whsk_test_1111')
        ->and($liveAccount->mode)
        ->toBe(PayMongoMode::Live)
        ->and($liveAccount->webhook_id)
        ->toBe('hook_live_222')
        ->and($liveAccount->webhook_secret)
        ->toBe('whsk_live_2222')
        ->and($testAccount->public_id)
        ->not->toBe($liveAccount->public_id);
});

test('failed webhook provisioning never replaces the previous selected account', function () {
    config()->set('app.url', 'https://thermasnap.example.com');

    Http::preventStrayRequests();

    Http::fake(function (HttpRequest $request) {
        if (
            $request->url()
            === 'https://api.paymongo.com/v1/merchants/capabilities/payment_methods'
        ) {
            return Http::response(['qrph']);
        }

        if ($request->url() === 'https://api.paymongo.com/v1/webhooks') {
            return Http::response([
                'errors' => [
                    [
                        'detail' => 'provider-private-detail sk_test_do-not-expose whsk_do-not-expose',
                    ],
                ],
            ], 500);
        }

        return Http::response([], 404);
    });

    $business = Business::factory()->create();

    $oldAccount = PayMongoAccount::factory()
        ->webhookProvisioned()
        ->for($business)
        ->create();

    $oldWebhookSecret = $oldAccount->webhook_secret;

    $business
        ->forceFill([
            'test_paymongo_account_id' => $oldAccount->id,
        ])
        ->save();

    $response = $this
        ->actingAs($business->owner)
        ->withSession([
            'auth.password_confirmed_at' => time(),
        ])
        ->put(
            route('admin.payment-settings.replace', [
                'mode' => 'test',
            ]),
            [
                'public_key' => 'pk_test_failed-public-3333',
                'secret_key' => 'sk_test_failed-secret-4444',
            ],
        );

    $response->assertSessionHasErrors([
        'test_connection' => 'PayMongo webhook provisioning is temporarily unavailable.',
    ]);

    $business->refresh();
    $oldAccount->refresh();

    $failedAccount = PayMongoAccount::query()
        ->latest('id')
        ->firstOrFail();

    expect($business->test_paymongo_account_id)
        ->toBe($oldAccount->id)
        ->and($oldAccount->superseded_at)
        ->toBeNull()
        ->and($oldAccount->webhook_secret)
        ->toBe($oldWebhookSecret)
        ->and($failedAccount->id)
        ->not->toBe($oldAccount->id)
        ->and($failedAccount->superseded_at)
        ->not->toBeNull()
        ->and($failedAccount->webhook_id)
        ->toBeNull();

    $response
        ->assertDontSee('provider-private-detail')
        ->assertDontSee('sk_test_do-not-expose')
        ->assertDontSee('whsk_do-not-expose');
});

test('webhook recovery is owner only and requires password confirmation', function () {
    config()->set('app.url', 'https://thermasnap.example.com');

    Http::preventStrayRequests();

    Http::fake(function (HttpRequest $request) {
        if (
            $request->url()
            === 'https://api.paymongo.com/v1/merchants/capabilities/payment_methods'
        ) {
            return Http::response(['qrph']);
        }

        if ($request->url() === 'https://api.paymongo.com/v1/webhooks') {
            $attributes = $request->data()['data']['attributes'];

            return Http::response(
                fakePayMongoWebhookResource(
                    'hook_recovered_123',
                    $attributes['url'],
                    $attributes['events'],
                    false,
                    'enabled',
                    'whsk_recovered_123',
                ),
            );
        }

        return Http::response([], 404);
    });

    $business = Business::factory()->create();

    $legacyAccount = PayMongoAccount::factory()
        ->verified()
        ->for($business)
        ->create();

    $business
        ->forceFill([
            'test_paymongo_account_id' => $legacyAccount->id,
        ])
        ->save();

    $member = User::factory()->create();

    $member
        ->forceFill([
            'business_id' => $business->id,
        ])
        ->save();

    $this
        ->actingAs($member)
        ->withSession([
            'auth.password_confirmed_at' => time(),
        ])
        ->post(
            route('admin.payment-settings.webhook.reprovision', [
                'mode' => 'test',
            ]),
        )
        ->assertForbidden();

    $this
        ->flushSession()
        ->actingAs($business->owner)
        ->post(
            route('admin.payment-settings.webhook.reprovision', [
                'mode' => 'test',
            ]),
        )
        ->assertRedirect(route('password.confirm'));

    $this
        ->actingAs($business->owner)
        ->withSession([
            'auth.password_confirmed_at' => time(),
        ])
        ->post(
            route('admin.payment-settings.webhook.reprovision', [
                'mode' => 'test',
            ]),
        )
        ->assertRedirect(route('admin.payment-settings.edit'));

    expect($legacyAccount->fresh()->isReadyForPayments())
        ->toBeTrue();
});

test('disabled webhook recovery re-enables the same webhook without replacing its secret', function () {
    config()->set('app.url', 'https://thermasnap.example.com');

    Http::preventStrayRequests();

    $business = Business::factory()->create();

    $account = PayMongoAccount::factory()
        ->webhookProvisioned()
        ->for($business)
        ->create([
            'webhook_id' => 'hook_disabled_123',
            'webhook_secret' => 'whsk_original_historical_secret',
            'webhook_status' => 'disabled',
        ]);

    $business
        ->forceFill([
            'test_paymongo_account_id' => $account->id,
        ])
        ->save();

    $callbackUrl = expectedPayMongoCallbackUrl($account);

    Http::fake(function (HttpRequest $request) use (
        $callbackUrl,
    ) {
        if (
            $request->url()
            === 'https://api.paymongo.com/v1/merchants/capabilities/payment_methods'
        ) {
            return Http::response(['qrph']);
        }

        if (
            $request->url()
            === 'https://api.paymongo.com/v1/webhooks/hook_disabled_123'
            && $request->method() === 'GET'
        ) {
            return Http::response(
                fakePayMongoWebhookResource(
                    'hook_disabled_123',
                    $callbackUrl,
                    [
                        'payment.paid',
                        'payment.failed',
                        'qrph.expired',
                    ],
                    false,
                    'disabled',
                ),
            );
        }

        if (
            $request->url()
            === 'https://api.paymongo.com/v1/webhooks/hook_disabled_123/enable'
            && $request->method() === 'POST'
        ) {
            return Http::response(
                fakePayMongoWebhookResource(
                    'hook_disabled_123',
                    $callbackUrl,
                    [
                        'payment.paid',
                        'payment.failed',
                        'qrph.expired',
                    ],
                    false,
                    'enabled',
                ),
            );
        }

        return Http::response([], 404);
    });

    $originalSecret = $account->webhook_secret;

    $this
        ->actingAs($business->owner)
        ->withSession([
            'auth.password_confirmed_at' => time(),
        ])
        ->post(
            route('admin.payment-settings.webhook.reprovision', [
                'mode' => 'test',
            ]),
        )
        ->assertRedirect(route('admin.payment-settings.edit'));

    $account->refresh();

    expect($account->webhook_id)
        ->toBe('hook_disabled_123')
        ->and($account->webhook_secret)
        ->toBe($originalSecret)
        ->and($account->webhook_status)
        ->toBe('enabled')
        ->and($account->isReadyForPayments())
        ->toBeTrue();

    Http::assertSent(fn (HttpRequest $request): bool => $request->url()
        === 'https://api.paymongo.com/v1/webhooks/hook_disabled_123/enable'
        && $request->method() === 'POST');
});

test('activation is blocked for verified credentials without webhook provisioning', function () {
    Http::preventStrayRequests();

    Http::fake([
        'https://api.paymongo.com/v1/merchants/capabilities/payment_methods' => Http::response([
            'qrph',
        ]),
    ]);

    $business = Business::factory()->create();

    $liveAccount = PayMongoAccount::factory()
        ->live()
        ->verified()
        ->for($business)
        ->create();

    $business
        ->forceFill([
            'live_paymongo_account_id' => $liveAccount->id,
        ])
        ->save();

    $this
        ->actingAs($business->owner)
        ->withSession([
            'auth.password_confirmed_at' => time(),
        ])
        ->post(
            route('admin.payment-settings.activate', [
                'mode' => 'live',
            ]),
        )
        ->assertSessionHasErrors([
            'live_activation' => 'Provision or recover the PayMongo webhook before activating this mode.',
        ]);

    expect($business->fresh()->active_paymongo_mode)
        ->toBe(PayMongoMode::Test);
});

test('production webhook provisioning rejects non public https application urls', function () {
    config()->set('app.env', 'production');
    config()->set('app.url', 'http://localhost');

    Http::preventStrayRequests();

    Http::fake([
        'https://api.paymongo.com/v1/merchants/capabilities/payment_methods' => Http::response([
            'qrph',
        ]),
    ]);

    $business = Business::factory()->create();

    $this
        ->actingAs($business->owner)
        ->withSession([
            'auth.password_confirmed_at' => time(),
        ])
        ->put(
            route('admin.payment-settings.replace', [
                'mode' => 'test',
            ]),
            [
                'public_key' => 'pk_test_local-public-1234',
                'secret_key' => 'sk_test_local-secret-5678',
            ],
        )
        ->assertSessionHasErrors([
            'test_connection' => 'Production PayMongo webhooks require a public HTTPS application URL.',
        ]);

    expect($business->fresh()->test_paymongo_account_id)
        ->toBeNull();

    Http::assertSentCount(1);
});

test('webhook callback uses the opaque public id and exposes no credential material', function () {
    $account = PayMongoAccount::factory()
        ->webhookProvisioned()
        ->create();

    $response = $this->postJson(
        route('webhooks.paymongo', [
            'paymongoAccount' => $account,
        ]),
        [
            'data' => [
                'type' => 'payment.paid',
            ],
        ],
    );

    $response
        ->assertOk()
        ->assertExactJson([
            'message' => 'Webhook endpoint ready.',
        ])
        ->assertDontSee($account->public_key)
        ->assertDontSee($account->secret_key)
        ->assertDontSee((string) $account->webhook_secret);

    expect(route('webhooks.paymongo', [
        'paymongoAccount' => $account,
    ]))
        ->toContain(
            '/webhooks/paymongo/'.$account->public_id,
        )
        ->not->toContain('/'.$account->id);
});

test('structured webhook logs contain operational identifiers but no secrets', function () {
    config()->set('app.url', 'https://thermasnap.example.com');

    Http::preventStrayRequests();
    Log::spy();

    $secretKey = 'sk_test_log-secret-5678';
    $webhookSecret = 'whsk_log-secret-9012';

    Http::fake(function (HttpRequest $request) use ($webhookSecret) {
        if (
            $request->url()
            === 'https://api.paymongo.com/v1/merchants/capabilities/payment_methods'
        ) {
            return Http::response(['qrph']);
        }

        if ($request->url() === 'https://api.paymongo.com/v1/webhooks') {
            $attributes = $request->data()['data']['attributes'];

            return Http::response(
                fakePayMongoWebhookResource(
                    'hook_log_123',
                    $attributes['url'],
                    $attributes['events'],
                    false,
                    'enabled',
                    $webhookSecret,
                ),
            );
        }

        return Http::response([], 404);
    });

    $business = Business::factory()->create();

    $this
        ->actingAs($business->owner)
        ->withSession([
            'auth.password_confirmed_at' => time(),
        ])
        ->put(
            route('admin.payment-settings.replace', [
                'mode' => 'test',
            ]),
            [
                'public_key' => 'pk_test_log-public-1234',
                'secret_key' => $secretKey,
            ],
        )
        ->assertRedirect(route('admin.payment-settings.edit'));

    Log::shouldHaveReceived('info')
        ->withArgs(function (
            string $message,
            array $context,
        ) use (
            $secretKey,
            $webhookSecret,
        ): bool {
            $encodedContext = json_encode($context);

            return $message
                    === 'PayMongo webhook provisioning result.'
                && is_string($encodedContext)
                && ($context['result'] ?? null) === 'provisioned'
                && ! str_contains($encodedContext, $secretKey)
                && ! str_contains($encodedContext, $webhookSecret)
                && ! str_contains($encodedContext, 'Authorization');
        })
        ->atLeast()
        ->once();
});
