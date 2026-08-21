<?php

use App\Enums\PhotoboothSessionStatus;
use App\Models\ApplicationSetting;
use App\Models\PhotoboothSession;

test('starting a session is blocked with a 503 while maintenance mode is enabled', function () {
    ApplicationSetting::updateOrCreate(['key' => 'maintenance_mode'], ['value' => '1']);
    ApplicationSetting::updateOrCreate(['key' => 'maintenance_message'], ['value' => 'Back soon!']);

    $response = $this->postJson(route('kiosk.sessions.store'));

    $response->assertStatus(503);
    $response->assertJson(['message' => 'Back soon!', 'maintenance' => true]);

    expect(PhotoboothSession::count())->toBe(0);
});

test('starting a session succeeds when maintenance mode is disabled', function () {
    ApplicationSetting::updateOrCreate(['key' => 'maintenance_mode'], ['value' => '0']);

    $response = $this->postJson(route('kiosk.sessions.store'));

    $response->assertCreated();

    expect(PhotoboothSession::count())->toBe(1);
});

test('an already-authorized session continues unaffected once maintenance mode is enabled mid-session', function () {
    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::Paid]);

    ApplicationSetting::updateOrCreate(['key' => 'maintenance_mode'], ['value' => '1']);
    ApplicationSetting::updateOrCreate(['key' => 'maintenance_message'], ['value' => 'Back soon!']);

    $response = $this->getJson(route('kiosk.sessions.show', $session->session_token));

    $response->assertOk();
    $response->assertJson([
        'sessionToken' => $session->session_token,
        'status' => PhotoboothSessionStatus::Paid->value,
    ]);
});
