<?php

use App\Enums\PhotoboothSessionStatus;
use App\Models\ApplicationSetting;
use App\Models\Business;
use App\Models\PhotoboothSession;
use App\Services\Settings;

test('maintenance_message falls back to an empty string when no ApplicationSetting override exists', function () {
    expect(Settings::get('maintenance_message'))->toBe('');
});

test('starting a session is blocked with a 503 while maintenance mode is enabled', function () {
    $business = Business::factory()->create();

    ApplicationSetting::updateOrCreate(
        ['key' => 'maintenance_mode'],
        ['value' => '1'],
    );

    ApplicationSetting::updateOrCreate(
        ['key' => 'maintenance_message'],
        ['value' => 'Back soon!'],
    );

    $response = $this->postJson(
        businessRoute('kiosk.sessions.store', $business),
    );

    $response->assertStatus(503);
    $response->assertJson([
        'message' => 'Back soon!',
        'maintenance' => true,
    ]);

    expect(PhotoboothSession::count())->toBe(0);
});

test('starting a session succeeds when maintenance mode is disabled', function () {
    $business = Business::factory()->create();

    ApplicationSetting::updateOrCreate(
        ['key' => 'maintenance_mode'],
        ['value' => '0'],
    );

    $this->postJson(
        businessRoute('kiosk.sessions.store', $business),
    )->assertCreated();

    expect(PhotoboothSession::count())->toBe(1);
});

test('an already-authorized session continues unaffected once maintenance mode is enabled mid-session', function () {
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Paid,
    ]);

    ApplicationSetting::updateOrCreate(
        ['key' => 'maintenance_mode'],
        ['value' => '1'],
    );

    ApplicationSetting::updateOrCreate(
        ['key' => 'maintenance_message'],
        ['value' => 'Back soon!'],
    );

    $response = $this->getJson(
        kioskSessionRoute(
            'kiosk.sessions.show',
            $session,
        ),
    );

    $response->assertOk();
    $response->assertJson([
        'sessionToken' => $session->session_token,
        'status' => PhotoboothSessionStatus::Paid->value,
    ]);
});
