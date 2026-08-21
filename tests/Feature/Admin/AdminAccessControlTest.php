<?php

use App\Models\User;

$adminRoutes = [
    'admin.dashboard',
    'admin.templates.index',
    'admin.stickers.index',
    'admin.vouchers.index',
    'admin.sessions.index',
    'admin.settings.edit',
];

test('guests are redirected to login for every admin route', function (string $routeName) {
    $response = $this->get(route($routeName));

    $response->assertRedirect(route('login'));
    $this->assertGuest();
})->with($adminRoutes);

test('unverified users are redirected to the verification notice for every admin route', function (string $routeName) {
    $user = User::factory()->unverified()->create();

    $response = $this->actingAs($user)->get(route($routeName));

    $response->assertRedirect(route('verification.notice'));
})->with($adminRoutes);

test('verified users can access the admin dashboard', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route('admin.dashboard'));

    $response->assertOk();
});
