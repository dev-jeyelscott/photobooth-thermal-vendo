<?php

use App\Models\User;

test('admin routes use the canonical admin hierarchy', function () {
    expect(route('admin.dashboard', absolute: false))->toBe('/admin')
        ->and(route('admin.templates.index', absolute: false))->toBe('/admin/templates')
        ->and(route('admin.stickers.index', absolute: false))->toBe('/admin/stickers')
        ->and(route('admin.vouchers.index', absolute: false))->toBe('/admin/vouchers')
        ->and(route('admin.sessions.index', absolute: false))->toBe('/admin/sessions')
        ->and(route('admin.settings.edit', absolute: false))->toBe('/admin/settings');

    $this->get('/dashboard')->assertNotFound();
});

test('authenticated users can directly load every admin page', function () {
    $user = User::factory()->create();

    $pages = [
        'admin.dashboard' => 'admin/dashboard',
        'admin.templates.index' => 'admin/templates/index',
        'admin.stickers.index' => 'admin/stickers/index',
        'admin.vouchers.index' => 'admin/vouchers/index',
        'admin.sessions.index' => 'admin/sessions/index',
        'admin.settings.edit' => 'admin/settings/edit',
    ];

    foreach ($pages as $route => $component) {
        $this->actingAs($user)
            ->get(route($route))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component($component));
    }
});
