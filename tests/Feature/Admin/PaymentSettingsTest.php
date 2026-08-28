<?php

use App\Enums\PayMongoMode;
use App\Models\Business;
use App\Models\PayMongoAccount;
use App\Models\User;
use App\Services\Payments\TenantPayMongoAccountResolver;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use RuntimeException;

/**
 * Fake successful credential verification and webhook provisioning.
 */
function fakeSuccessfulPaymentSettingsProvisioning(): void
{
    Http::fake(function (HttpRequest $request) {
        if (
            $request->url()
            === 'https://api.paymongo.com/v1/merchants/capabilities/payment_methods'
        ) {
            return Http::response([
                'card',
                'qrph',
            ]);
        }

        if (
            $request->url() === 'https://api.paymongo.com/v1/webhooks'
            && $request->method() === 'POST'
        ) {
            $attributes = $request->data()['data']['attributes'] ?? [];

            return Http::response([
                'data' => [
                    'id' => 'hook_'.Str::random(24),
                    'type' => 'webhook',
                    'attributes' => [
                        'events' => $attributes['events'] ?? [],
                        'livemode' => false,
                        'secret_key' => 'whsk_'.Str::random(32),
                        'status' => 'enabled',
                        'url' => $attributes['url'] ?? '',
                        'created_at' => now()->timestamp,
                        'updated_at' => now()->timestamp,
                    ],
                ],
            ]);
        }

        return Http::response([], 404);
    });
}

test('business owner sees masked payment settings without decrypted credentials', function () {
    $business = Business::factory()->create();

    $publicKey = 'pk_test_example-public-1234';
    $secretKey = 'sk_test_example-secret-5678';

    $account = PayMongoAccount::factory()
        ->webhookProvisioned()
        ->for($business)
        ->create([
            'public_key' => $publicKey,
            'secret_key' => $secretKey,
            'public_key_last4' => '1234',
            'secret_key_last4' => '5678',
        ]);

    $business
        ->forceFill([
            'test_paymongo_account_id' => $account->id,
        ])
        ->save();

    $response = $this
        ->actingAs($business->owner)
        ->get(route('admin.payment-settings.edit'));

    $response
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/payment-settings/edit')
            ->where('businessName', $business->name)
            ->where('activeMode', 'test')
            ->where('accounts.test.webhookReady', true)
            ->where(
                'accounts.test.maskedPublicKey',
                'pk_test_••••1234',
            )
            ->where(
                'accounts.test.maskedSecretKey',
                'sk_test_••••5678',
            )
            ->missing('accounts.test.public_key')
            ->missing('accounts.test.secret_key')
            ->missing('accounts.test.webhook_secret'),
        );

    $response
        ->assertDontSee($publicKey)
        ->assertDontSee($secretKey)
        ->assertDontSee((string) $account->webhook_secret);
});

test('non owner business member cannot access payment settings', function () {
    $business = Business::factory()->create();

    $member = User::factory()->create();

    $member
        ->forceFill(['business_id' => $business->id])
        ->save();

    $this
        ->actingAs($member)
        ->get(route('admin.payment-settings.edit'))
        ->assertForbidden();
});

test('credential replacement requires recent password confirmation', function () {
    Http::preventStrayRequests();

    $business = Business::factory()->create();

    $this
        ->actingAs($business->owner)
        ->put(
            route('admin.payment-settings.replace', [
                'mode' => 'test',
            ]),
            [
                'public_key' => 'pk_test_example-public-1234',
                'secret_key' => 'sk_test_example-secret-5678',
            ],
        )
        ->assertRedirect(route('password.confirm'));

    expect(PayMongoAccount::query()->count())->toBe(0);
});

test('credential replacement validates key prefixes against route mode', function () {
    Http::preventStrayRequests();

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
                'public_key' => 'pk_live_example-public-1234',
                'secret_key' => 'sk_live_example-secret-5678',
            ],
        )
        ->assertSessionHasErrors([
            'public_key',
            'secret_key',
        ]);

    expect(PayMongoAccount::query()->count())->toBe(0);
});

test('credential payload cannot choose another business', function () {
    Http::preventStrayRequests();

    $business = Business::factory()->create();
    $otherBusiness = Business::factory()->create();

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
                'business_id' => $otherBusiness->id,
                'public_key' => 'pk_test_example-public-1234',
                'secret_key' => 'sk_test_example-secret-5678',
            ],
        )
        ->assertSessionHasErrors('business_id');

    expect(PayMongoAccount::query()->count())->toBe(0);
});

test('verified and provisioned credentials are encrypted at rest and selected for the owner business', function () {
    config()->set('app.url', 'https://thermasnap.example.com');

    Http::preventStrayRequests();
    fakeSuccessfulPaymentSettingsProvisioning();

    $business = Business::factory()->create();

    $publicKey = 'pk_test_example-public-1234';
    $secretKey = 'sk_test_example-secret-5678';

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

    $rawAccount = DB::table('paymongo_accounts')
        ->where('id', $account->id)
        ->first();

    expect($account->public_key)
        ->toBe($publicKey)
        ->and($account->secret_key)
        ->toBe($secretKey)
        ->and($account->verified_at)
        ->not->toBeNull()
        ->and($account->webhook_provisioned_at)
        ->not->toBeNull()
        ->and($account->webhook_status)
        ->toBe('enabled')
        ->and($account->isReadyForPayments())
        ->toBeTrue()
        ->and((string) $rawAccount->public_key)
        ->not->toBe($publicKey)
        ->and((string) $rawAccount->secret_key)
        ->not->toBe($secretKey)
        ->and((string) $rawAccount->webhook_secret)
        ->not->toBe($account->webhook_secret)
        ->and((string) $rawAccount->public_key)
        ->not->toContain('pk_test_')
        ->and((string) $rawAccount->secret_key)
        ->not->toContain('sk_test_')
        ->and((string) $rawAccount->webhook_secret)
        ->not->toContain('whsk_');

    $serialized = $account->toArray();

    expect(array_key_exists('public_key', $serialized))
        ->toBeFalse()
        ->and(array_key_exists('secret_key', $serialized))
        ->toBeFalse()
        ->and(array_key_exists('webhook_secret', $serialized))
        ->toBeFalse();

    expect($business->fresh()->test_paymongo_account_id)
        ->toBe($account->id);

    Http::assertSent(function (HttpRequest $request) use ($secretKey): bool {
        return $request->url()
                === 'https://api.paymongo.com/v1/merchants/capabilities/payment_methods'
            && $request->hasHeader(
                'Authorization',
                'Basic '.base64_encode($secretKey.':'),
            );
    });
});

test('qrph capability is required before a credential version is stored', function () {
    Http::preventStrayRequests();

    Http::fake([
        'https://api.paymongo.com/v1/merchants/capabilities/payment_methods' => Http::response([
            'card',
            'gcash',
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
                'public_key' => 'pk_test_example-public-1234',
                'secret_key' => 'sk_test_example-secret-5678',
            ],
        )
        ->assertSessionHasErrors('test_connection');

    expect(PayMongoAccount::query()->count())
        ->toBe(0)
        ->and($business->fresh()->test_paymongo_account_id)
        ->toBeNull();
});

test('credential replacement retains historical account and webhook secret', function () {
    config()->set('app.url', 'https://thermasnap.example.com');

    Http::preventStrayRequests();
    fakeSuccessfulPaymentSettingsProvisioning();

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
                'public_key' => 'pk_test_first-public-1111',
                'secret_key' => 'sk_test_first-secret-2222',
            ],
        )
        ->assertRedirect(route('admin.payment-settings.edit'));

    $oldAccount = PayMongoAccount::query()->firstOrFail();
    $oldWebhookId = $oldAccount->webhook_id;
    $oldWebhookSecret = $oldAccount->webhook_secret;

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
                'public_key' => 'pk_test_second-public-3333',
                'secret_key' => 'sk_test_second-secret-4444',
            ],
        )
        ->assertRedirect(route('admin.payment-settings.edit'));

    $newAccount = PayMongoAccount::query()
        ->latest('id')
        ->firstOrFail();

    $oldAccount->refresh();

    expect(PayMongoAccount::query()
        ->where('business_id', $business->id)
        ->count())
        ->toBe(2)
        ->and($oldAccount->superseded_at)
        ->not->toBeNull()
        ->and($oldAccount->webhook_id)
        ->toBe($oldWebhookId)
        ->and($oldAccount->webhook_secret)
        ->toBe($oldWebhookSecret)
        ->and($newAccount->id)
        ->not->toBe($oldAccount->id)
        ->and($newAccount->isReadyForPayments())
        ->toBeTrue()
        ->and($business->fresh()->test_paymongo_account_id)
        ->toBe($newAccount->id);
});

test('test connection revalidates the currently selected account', function () {
    Http::preventStrayRequests();

    Http::fake([
        'https://api.paymongo.com/v1/merchants/capabilities/payment_methods' => Http::response([
            'qrph',
        ]),
    ]);

    $business = Business::factory()->create();

    $account = PayMongoAccount::factory()
        ->for($business)
        ->create();

    $business
        ->forceFill([
            'test_paymongo_account_id' => $account->id,
        ])
        ->save();

    $this
        ->actingAs($business->owner)
        ->post(
            route('admin.payment-settings.test', [
                'mode' => 'test',
            ]),
        )
        ->assertRedirect(route('admin.payment-settings.edit'));

    expect($account->fresh()->verified_at)->not->toBeNull();
});

test('mode activation requires password confirmation current verification and provisioned webhook', function () {
    Http::preventStrayRequests();

    Http::fake([
        'https://api.paymongo.com/v1/merchants/capabilities/payment_methods' => Http::response([
            'qrph',
        ]),
    ]);

    $business = Business::factory()->create();

    $liveAccount = PayMongoAccount::factory()
        ->live()
        ->webhookProvisioned()
        ->for($business)
        ->create();

    $business
        ->forceFill([
            'live_paymongo_account_id' => $liveAccount->id,
        ])
        ->save();

    $this
        ->actingAs($business->owner)
        ->post(
            route('admin.payment-settings.activate', [
                'mode' => 'live',
            ]),
        )
        ->assertRedirect(route('password.confirm'));

    expect($business->fresh()->active_paymongo_mode)
        ->toBe(PayMongoMode::Test);

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
        ->assertRedirect(route('admin.payment-settings.edit'));

    expect($business->fresh()->active_paymongo_mode)
        ->toBe(PayMongoMode::Live);
});

test('tenant account resolver never falls back to platform credentials', function () {
    config()->set(
        'services.paymongo.platform.public_key',
        'pk_live_platform-public',
    );

    config()->set(
        'services.paymongo.platform.secret_key',
        'sk_live_platform-secret',
    );

    $business = Business::factory()->create();

    expect(
        fn () => app(TenantPayMongoAccountResolver::class)
            ->resolve($business),
    )->toThrow(
        RuntimeException::class,
        'The business does not have a verified and webhook-provisioned PayMongo account for its active mode.',
    );
});

test('tenant resolver rejects verified credentials without a provisioned webhook', function () {
    $business = Business::factory()->create();

    $account = PayMongoAccount::factory()
        ->verified()
        ->for($business)
        ->create();

    $business
        ->forceFill([
            'test_paymongo_account_id' => $account->id,
        ])
        ->save();

    expect(
        fn () => app(TenantPayMongoAccountResolver::class)
            ->resolve($business->fresh()),
    )->toThrow(
        RuntimeException::class,
        'The business does not have a verified and webhook-provisioned PayMongo account for its active mode.',
    );
});

test('tenant resolver rejects a selected account owned by another business', function () {
    $business = Business::factory()->create();
    $otherBusiness = Business::factory()->create();

    $otherAccount = PayMongoAccount::factory()
        ->webhookProvisioned()
        ->for($otherBusiness)
        ->create();

    DB::table('businesses')
        ->where('id', $business->id)
        ->update([
            'test_paymongo_account_id' => $otherAccount->id,
        ]);

    $business->refresh();

    expect(
        fn () => app(TenantPayMongoAccountResolver::class)
            ->resolve($business),
    )->toThrow(
        RuntimeException::class,
        'The selected PayMongo account does not belong to this business and mode.',
    );
});
