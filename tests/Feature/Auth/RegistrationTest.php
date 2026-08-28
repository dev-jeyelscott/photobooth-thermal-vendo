<?php

use App\Models\Business;
use App\Models\User;
use Laravel\Fortify\Features;

beforeEach(function () {
    $this->skipUnlessFortifyHas(Features::registration());
});

test('registration screen can be rendered', function () {
    $response = $this->get(route('register'));

    $response->assertOk();
});

test('new users can register and become the owner of their business', function () {
    $response = $this->post(route('register.store'), [
        'name' => 'Test User',
        'email' => 'test@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ]);

    $this->assertAuthenticated();

    $response->assertRedirect(
        route('admin.dashboard', absolute: false),
    );

    $user = User::query()
        ->where('email', 'test@example.com')
        ->firstOrFail();

    $business = Business::query()
        ->where('owner_user_id', $user->id)
        ->firstOrFail();

    expect($user->business_id)
        ->toBe($business->id)
        ->and($business->owner_user_id)
        ->toBe($user->id);
});
