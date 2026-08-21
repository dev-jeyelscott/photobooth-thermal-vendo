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
        ->and(Settings::get('currency'))->toBe(config('photobooth.currency'))
        ->and(Settings::get('countdown_seconds'))->toBe(config('photobooth.countdown_seconds'))
        ->and(Settings::get('capture_shot_count'))->toBe(config('photobooth.capture_shot_count'))
        ->and(Settings::get('retake_limit'))->toBe(config('photobooth.retake_limit'))
        ->and(Settings::get('kiosk_idle_timeout_seconds'))->toBe(config('photobooth.kiosk_idle_timeout_seconds'))
        ->and(Settings::get('gallery_expiration_hours'))->toBe(config('photobooth.gallery_expiration_hours'))
        ->and(Settings::get('receipt_header'))->toBe(config('photobooth.receipt_header'))
        ->and(Settings::get('receipt_footer'))->toBe(config('photobooth.receipt_footer'))
        ->and(Settings::get('maintenance_mode'))->toBe(config('photobooth.maintenance_mode'))
        ->and(Settings::get('maintenance_message'))->toBe(config('photobooth.maintenance_message'))
        ->and(Settings::get('booth_display_name'))->toBe(config('photobooth.booth_display_name'));
});

test('admin sees effective settings falling back to config defaults', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route('admin.settings.edit'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/settings/edit')
        ->where('settings.session_price', fn ($value) => (float) $value === (float) config('photobooth.session_price'))
        ->where('settings.currency', config('photobooth.currency'))
        ->where('settings.countdown_seconds', config('photobooth.countdown_seconds'))
        ->where('settings.capture_shot_count', config('photobooth.capture_shot_count'))
        ->where('settings.retake_limit', config('photobooth.retake_limit'))
        ->where('settings.kiosk_idle_timeout_seconds', config('photobooth.kiosk_idle_timeout_seconds'))
        ->where('settings.receipt_header', config('photobooth.receipt_header'))
        ->where('settings.receipt_footer', config('photobooth.receipt_footer'))
        ->where('settings.maintenance_mode', config('photobooth.maintenance_mode'))
        ->where('settings.maintenance_message', config('photobooth.maintenance_message'))
        ->where('settings.booth_display_name', config('photobooth.booth_display_name'))
    );
});

test('admin can update system settings and they persist as application setting rows', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->put(route('admin.settings.update'), [
        'session_price' => 25.50,
        'currency' => 'USD',
        'countdown_seconds' => 5,
        'capture_shot_count' => 4,
        'retake_limit' => 3,
        'kiosk_idle_timeout_seconds' => 90,
        'session_timeout_seconds' => 600,
        'gallery_expiration_hours' => 72,
        'gif_frame_duration_ms' => 750,
        'default_printer' => 'network_printer',
        'booth_display_name' => 'Downtown Booth',
        'receipt_header' => 'Welcome!',
        'receipt_footer' => 'Come again!',
        'maintenance_mode' => true,
        'maintenance_message' => 'Undergoing maintenance.',
    ]);

    $response->assertRedirect(route('admin.settings.edit'));

    expect(ApplicationSetting::where('key', 'session_price')->value('value'))->toBe('25.5')
        ->and(ApplicationSetting::where('key', 'currency')->value('value'))->toBe('USD')
        ->and(ApplicationSetting::where('key', 'countdown_seconds')->value('value'))->toBe('5')
        ->and(ApplicationSetting::where('key', 'capture_shot_count')->value('value'))->toBe('4')
        ->and(ApplicationSetting::where('key', 'retake_limit')->value('value'))->toBe('3')
        ->and(ApplicationSetting::where('key', 'kiosk_idle_timeout_seconds')->value('value'))->toBe('90')
        ->and(ApplicationSetting::where('key', 'receipt_header')->value('value'))->toBe('Welcome!')
        ->and(ApplicationSetting::where('key', 'receipt_footer')->value('value'))->toBe('Come again!')
        ->and(ApplicationSetting::where('key', 'maintenance_mode')->value('value'))->toBe('1')
        ->and(ApplicationSetting::where('key', 'maintenance_message')->value('value'))->toBe('Undergoing maintenance.')
        ->and(ApplicationSetting::where('key', 'booth_display_name')->value('value'))->toBe('Downtown Booth');

    expect(Settings::get('session_price'))->toBe(25.5)
        ->and(Settings::get('currency'))->toBe('USD')
        ->and(Settings::get('countdown_seconds'))->toBe(5)
        ->and(Settings::get('capture_shot_count'))->toBe(4)
        ->and(Settings::get('retake_limit'))->toBe(3)
        ->and(Settings::get('kiosk_idle_timeout_seconds'))->toBe(90)
        ->and(Settings::get('default_printer'))->toBe('network_printer')
        ->and(Settings::get('receipt_header'))->toBe('Welcome!')
        ->and(Settings::get('receipt_footer'))->toBe('Come again!')
        ->and(Settings::get('maintenance_mode'))->toBeTrue()
        ->and(Settings::get('maintenance_message'))->toBe('Undergoing maintenance.')
        ->and(Settings::get('booth_display_name'))->toBe('Downtown Booth');
});

test('admin cannot save a negative or zero session price', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->put(route('admin.settings.update'), [
        'session_price' => 0,
        'currency' => 'PHP',
        'countdown_seconds' => 3,
        'capture_shot_count' => 3,
        'retake_limit' => 3,
        'kiosk_idle_timeout_seconds' => 60,
        'session_timeout_seconds' => 600,
        'gallery_expiration_hours' => 72,
        'gif_frame_duration_ms' => 750,
        'default_printer' => 'network_printer',
        'booth_display_name' => 'Downtown Booth',
        'maintenance_mode' => false,
    ]);

    $response->assertSessionHasErrors('session_price');
    expect(ApplicationSetting::where('key', 'session_price')->exists())->toBeFalse();
});

test('admin cannot enable maintenance mode without a message', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->put(route('admin.settings.update'), [
        'session_price' => 20,
        'currency' => 'PHP',
        'countdown_seconds' => 3,
        'capture_shot_count' => 3,
        'retake_limit' => 3,
        'kiosk_idle_timeout_seconds' => 60,
        'session_timeout_seconds' => 600,
        'gallery_expiration_hours' => 72,
        'gif_frame_duration_ms' => 750,
        'default_printer' => 'network_printer',
        'booth_display_name' => 'Downtown Booth',
        'maintenance_mode' => true,
    ]);

    $response->assertSessionHasErrors('maintenance_message');
});
