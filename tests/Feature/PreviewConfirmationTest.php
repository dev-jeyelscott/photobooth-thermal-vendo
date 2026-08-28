<?php

use App\Enums\PhotoboothSessionStatus;
use App\Models\Business;
use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use App\Models\StickerDesign;
use Illuminate\Support\Str;

test('confirming the preview advances a template-selected session to processing', function () {
    $template = PhotoTemplate::factory()->create();
    $sticker = StickerDesign::factory()->create();

    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::TemplateSelected,
        'photo_template_id' => $template->id,
        'sticker_design_id' => $sticker->id,
    ]);

    $response = $this->postJson(
        kioskSessionRoute(
            'kiosk.sessions.preview.store',
            $session,
        ),
    );

    $response->assertOk();
    $response->assertJson([
        'status' => PhotoboothSessionStatus::Processing->value,
    ]);

    expect($session->fresh()->status)
        ->toBe(PhotoboothSessionStatus::Processing);
});

test('confirming the preview advances a customizing session to processing', function () {
    $template = PhotoTemplate::factory()->create();

    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Customizing,
        'photo_template_id' => $template->id,
    ]);

    $this->postJson(
        kioskSessionRoute(
            'kiosk.sessions.preview.store',
            $session,
        ),
    )
        ->assertOk()
        ->assertJson([
            'status' => PhotoboothSessionStatus::Processing->value,
        ]);

    expect($session->fresh()->status)
        ->toBe(PhotoboothSessionStatus::Processing);
});

test('confirming the preview before a template has been chosen is rejected', function () {
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Paid,
        'photo_template_id' => null,
    ]);

    $this->postJson(
        kioskSessionRoute(
            'kiosk.sessions.preview.store',
            $session,
        ),
    )->assertStatus(422);

    expect($session->fresh()->status)
        ->toBe(PhotoboothSessionStatus::Paid);
});

test('confirming the preview on a session already past processing is rejected', function () {
    $template = PhotoTemplate::factory()->create();

    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Printing,
        'photo_template_id' => $template->id,
    ]);

    $this->postJson(
        kioskSessionRoute(
            'kiosk.sessions.preview.store',
            $session,
        ),
    )->assertStatus(422);

    expect($session->fresh()->status)
        ->toBe(PhotoboothSessionStatus::Printing);
});

test('confirming the preview on an expired session is rejected', function () {
    $template = PhotoTemplate::factory()->create();

    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::TemplateSelected,
        'photo_template_id' => $template->id,
        'expires_at' => now()->subMinute(),
    ]);

    $this->postJson(
        kioskSessionRoute(
            'kiosk.sessions.preview.store',
            $session,
        ),
    )->assertStatus(422);

    expect($session->fresh()->status)
        ->toBe(PhotoboothSessionStatus::Expired);
});

test('confirming the preview for an unknown session returns not found', function () {
    $business = Business::factory()->create();

    $this->postJson(
        kioskSessionRoute(
            'kiosk.sessions.preview.store',
            (string) Str::uuid(),
            $business,
        ),
    )->assertNotFound();
});
