<?php

use App\Models\ApplicationSetting;
use App\Models\User;
use App\Services\Settings;

test('settings routes require authentication', function () {
    $this->get(route('admin.settings.edit'))->assertRedirect(route('login'));
    $this->put(route('admin.settings.update'), [])->assertRedirect(route('login'));
});

test('settings accessor falls back to config defaults when no row exists', function () {
    expect(Settings::get('session_price'))->toBe(config('photobooth.session_price'))
        ->and(Settings::get('retake_limit'))->toBe(config('photobooth.retake_limit'))
        ->and(Settings::get('booth_display_name'))->toBe(config('photobooth.booth_display_name'));
});

test('admin sees effective settings falling back to config defaults', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route('admin.settings.edit'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/settings/edit')
        ->where('settings.session_price', fn ($value) => (float) $value === (float) config('photobooth.session_price'))
        ->where('settings.retake_limit', config('photobooth.retake_limit'))
        ->where('settings.booth_display_name', config('photobooth.booth_display_name'))
    );
});

test('admin can update system settings and they persist as application setting rows', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->put(route('admin.settings.update'), [
        'session_price' => 25.50,
        'retake_limit' => 3,
        'session_timeout_seconds' => 600,
        'gallery_expiration_hours' => 72,
        'gif_frame_duration_ms' => 750,
        'default_printer' => 'network_printer',
        'booth_display_name' => 'Downtown Booth',
    ]);

    $response->assertRedirect(route('admin.settings.edit'));

    expect(ApplicationSetting::where('key', 'session_price')->value('value'))->toBe('25.5')
        ->and(ApplicationSetting::where('key', 'retake_limit')->value('value'))->toBe('3')
        ->and(ApplicationSetting::where('key', 'booth_display_name')->value('value'))->toBe('Downtown Booth');

    expect(Settings::get('session_price'))->toBe(25.5)
        ->and(Settings::get('retake_limit'))->toBe(3)
        ->and(Settings::get('default_printer'))->toBe('network_printer')
        ->and(Settings::get('booth_display_name'))->toBe('Downtown Booth');
});

test('admin cannot save a negative or zero session price', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->put(route('admin.settings.update'), [
        'session_price' => 0,
        'retake_limit' => 3,
        'session_timeout_seconds' => 600,
        'gallery_expiration_hours' => 72,
        'gif_frame_duration_ms' => 750,
        'default_printer' => 'network_printer',
        'booth_display_name' => 'Downtown Booth',
    ]);

    $response->assertSessionHasErrors('session_price');
    expect(ApplicationSetting::where('key', 'session_price')->exists())->toBeFalse();
});
