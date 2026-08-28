<?php

use App\Models\Business;
use App\Models\PhotoboothSession;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

test('a business has a unique public slug and explicit owner', function () {
    $business = Business::factory()->create([
        'slug' => 'acme-photo',
    ]);

    expect($business->owner_user_id)
        ->toBe($business->owner->id)
        ->and($business->owner->business_id)
        ->toBe($business->id)
        ->and($business->users()->whereKey($business->owner)->exists())
        ->toBeTrue();
});

test('business slugs are globally unique', function () {
    Business::factory()->create([
        'slug' => 'acme-photo',
    ]);

    expect(
        fn () => Business::factory()->create([
            'slug' => 'acme-photo',
        ]),
    )->toThrow(QueryException::class);
});

test('fortify registration creates and assigns an owned business', function () {
    $this->post(route('register.store'), [
        'name' => 'Acme Photo',
        'email' => 'owner@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertRedirect(route('admin.dashboard', absolute: false));

    $user = User::query()
        ->where('email', 'owner@example.com')
        ->firstOrFail();

    $business = Business::query()
        ->where('owner_user_id', $user->id)
        ->firstOrFail();

    expect($user->business_id)
        ->toBe($business->id)
        ->and($business->slug)
        ->toBe("acme-photo-{$user->id}");
});

test('two registrations with the same display name receive unique slugs', function () {
    $this->post(route('register.store'), [
        'name' => 'Acme Photo',
        'email' => 'first@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertRedirect();

    auth()->logout();

    $this->post(route('register.store'), [
        'name' => 'Acme Photo',
        'email' => 'second@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertRedirect();

    $slugs = Business::query()
        ->orderBy('id')
        ->pluck('slug');

    expect($slugs)
        ->toHaveCount(2)
        ->and($slugs->unique())
        ->toHaveCount(2);
});

test('tenant slug kiosk renders the canonical kiosk page', function () {
    $business = Business::factory()->create([
        'slug' => 'acme-photo',
    ]);

    $this->get(businessRoute('business.kiosk', $business))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('kiosk')
            ->where('businessSlug', 'acme-photo'),
        );
});

test('session creation uses the route business and ignores submitted business ids', function () {
    $businessA = Business::factory()->create([
        'slug' => 'business-a',
    ]);

    $businessB = Business::factory()->create([
        'slug' => 'business-b',
    ]);

    $response = $this->postJson(
        businessRoute('kiosk.sessions.store', $businessA),
        [
            'business_id' => $businessB->id,
        ],
    );

    $response->assertCreated();

    $session = PhotoboothSession::query()
        ->where(
            'session_token',
            $response->json('sessionToken'),
        )
        ->firstOrFail();

    expect($session->business_id)->toBe($businessA->id);
});

test('a session cannot be read through another business slug', function () {
    $businessA = Business::factory()->create();
    $businessB = Business::factory()->create();

    $session = PhotoboothSession::factory()
        ->for($businessA)
        ->create();

    $this->getJson(
        kioskSessionRoute(
            'kiosk.sessions.show',
            $session,
            $businessB,
        ),
    )->assertNotFound();
});

test('every session mutation rejects a valid token under another business slug', function (
    string $routeName,
) {
    $businessA = Business::factory()->create();
    $businessB = Business::factory()->create();

    $session = PhotoboothSession::factory()
        ->for($businessA)
        ->create();

    $this->postJson(
        kioskSessionRoute(
            $routeName,
            $session,
            $businessB,
        ),
    )->assertNotFound();
})->with([
    'payment' => 'kiosk.sessions.payments.store',
    'voucher' => 'kiosk.sessions.voucher.store',
    'template' => 'kiosk.sessions.template.store',
    'sticker' => 'kiosk.sessions.sticker.store',
    'preview' => 'kiosk.sessions.preview.store',
    'capture' => 'kiosk.sessions.shots.store',
    'processing' => 'kiosk.sessions.color-output.store',
]);

test('sticker compatibility lookup cannot inspect another business session', function () {
    $businessA = Business::factory()->create();
    $businessB = Business::factory()->create();

    $session = PhotoboothSession::factory()
        ->for($businessA)
        ->create();

    $this->getJson(
        businessRoute(
            'stickers.index',
            $businessB,
            [
                'sessionToken' => $session->session_token,
            ],
        ),
    )->assertNotFound();
});

test('an unknown session token returns not found within a valid business', function () {
    $business = Business::factory()->create();

    $this->getJson(
        kioskSessionRoute(
            'kiosk.sessions.show',
            (string) Str::uuid(),
            $business,
        ),
    )->assertNotFound();
});

test('a business owner cannot delete the account while still owning the business', function () {
    $business = Business::factory()->create();
    $owner = $business->owner;

    $this->actingAs($owner)
        ->from(route('profile.edit'))
        ->delete(route('profile.destroy'), [
            'password' => 'password',
        ])
        ->assertSessionHasErrors('password')
        ->assertRedirect(route('profile.edit'));

    expect($owner->fresh())
        ->not->toBeNull()
        ->and($business->fresh()->owner_user_id)
        ->toBe($owner->id);
});
