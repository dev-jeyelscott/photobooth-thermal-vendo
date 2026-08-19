<?php

use App\Enums\PhotoboothSessionStatus;
use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use Illuminate\Support\Str;

test('the public template list only returns active templates with their layout and print details', function () {
    $active = PhotoTemplate::factory()->create([
        'name' => 'Classic Strip',
        'photo_slots' => 3,
        'layout_config' => ['slots' => [['slot' => 1, 'x' => 0, 'y' => 0]]],
        'print_width_mm' => 100,
        'print_height_mm' => 150,
    ]);
    PhotoTemplate::factory()->inactive()->create();

    $response = $this->getJson(route('templates.index'));

    $response->assertOk();
    $response->assertJson([
        'templates' => [
            [
                'id' => $active->id,
                'name' => 'Classic Strip',
                'thumbnailPath' => $active->thumbnail_path,
                'photoSlots' => 3,
                'layoutConfig' => ['slots' => [['slot' => 1, 'x' => 0, 'y' => 0]]],
                'printWidthMm' => 100,
                'printHeightMm' => 150,
            ],
        ],
    ]);
    expect($response->json('templates'))->toHaveCount(1);
});

test('selecting a template on a paid session attaches it and advances to template_selected', function () {
    $template = PhotoTemplate::factory()->create();
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Paid,
        'photo_template_id' => null,
    ]);

    $response = $this->postJson(route('kiosk.sessions.template.store', $session->session_token), [
        'photoTemplateId' => $template->id,
    ]);

    $response->assertOk();
    $response->assertJson(['status' => PhotoboothSessionStatus::TemplateSelected->value]);

    expect($session->fresh()->photo_template_id)->toBe($template->id)
        ->and($session->fresh()->status)->toBe(PhotoboothSessionStatus::TemplateSelected);
});

test('selecting an inactive template is rejected', function () {
    $template = PhotoTemplate::factory()->inactive()->create();
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Paid,
        'photo_template_id' => null,
    ]);

    $response = $this->postJson(route('kiosk.sessions.template.store', $session->session_token), [
        'photoTemplateId' => $template->id,
    ]);

    $response->assertStatus(422);

    expect($session->fresh()->photo_template_id)->toBeNull()
        ->and($session->fresh()->status)->toBe(PhotoboothSessionStatus::Paid);
});

test('selecting a template on a non-paid session is rejected', function () {
    $template = PhotoTemplate::factory()->create();
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::New,
        'photo_template_id' => null,
    ]);

    $response = $this->postJson(route('kiosk.sessions.template.store', $session->session_token), [
        'photoTemplateId' => $template->id,
    ]);

    $response->assertStatus(422);

    expect($session->fresh()->photo_template_id)->toBeNull()
        ->and($session->fresh()->status)->toBe(PhotoboothSessionStatus::New);
});

test('selecting a template on an expired session is rejected', function () {
    $template = PhotoTemplate::factory()->create();
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Paid,
        'photo_template_id' => null,
        'expires_at' => now()->subMinute(),
    ]);

    $response = $this->postJson(route('kiosk.sessions.template.store', $session->session_token), [
        'photoTemplateId' => $template->id,
    ]);

    $response->assertStatus(422);

    expect($session->fresh()->photo_template_id)->toBeNull()
        ->and($session->fresh()->status)->toBe(PhotoboothSessionStatus::Expired);
});

test('selecting a template for an unknown session returns not found', function () {
    $template = PhotoTemplate::factory()->create();

    $response = $this->postJson(route('kiosk.sessions.template.store', (string) Str::uuid()), [
        'photoTemplateId' => $template->id,
    ]);

    $response->assertNotFound();
});
