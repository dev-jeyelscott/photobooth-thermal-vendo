<?php

use App\Enums\PhotoboothSessionStatus;
use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use App\Models\StickerDesign;
use Illuminate\Support\Str;

test('the public sticker list only returns active stickers with their asset details', function () {
    $active = StickerDesign::factory()->create([
        'name' => 'Party Hat',
    ]);
    StickerDesign::factory()->inactive()->create();

    $response = $this->getJson(route('stickers.index'));

    $response->assertOk();
    $response->assertJson([
        'stickers' => [
            [
                'id' => $active->id,
                'name' => 'Party Hat',
                'assetPath' => $active->asset_path,
                'thumbnailPath' => $active->thumbnail_path,
            ],
        ],
    ]);
    expect($response->json('stickers'))->toHaveCount(1);
});

test('selecting a sticker on a session with a template attaches it without changing status', function () {
    $sticker = StickerDesign::factory()->create();
    $template = PhotoTemplate::factory()->create();
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::TemplateSelected,
        'photo_template_id' => $template->id,
        'sticker_design_id' => null,
    ]);

    $response = $this->postJson(route('kiosk.sessions.sticker.store', $session->session_token), [
        'stickerDesignId' => $sticker->id,
    ]);

    $response->assertOk();
    $response->assertJson(['status' => PhotoboothSessionStatus::TemplateSelected->value]);

    expect($session->fresh()->sticker_design_id)->toBe($sticker->id)
        ->and($session->fresh()->status)->toBe(PhotoboothSessionStatus::TemplateSelected);
});

test('the customer can change their sticker selection before finalizing', function () {
    $firstSticker = StickerDesign::factory()->create();
    $secondSticker = StickerDesign::factory()->create();
    $template = PhotoTemplate::factory()->create();
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Capturing,
        'photo_template_id' => $template->id,
        'sticker_design_id' => $firstSticker->id,
    ]);

    $response = $this->postJson(route('kiosk.sessions.sticker.store', $session->session_token), [
        'stickerDesignId' => $secondSticker->id,
    ]);

    $response->assertOk();

    expect($session->fresh()->sticker_design_id)->toBe($secondSticker->id);
    expect(PhotoboothSession::where('session_token', $session->session_token)->count())->toBe(1);
});

test('selecting an inactive sticker is rejected', function () {
    $sticker = StickerDesign::factory()->inactive()->create();
    $template = PhotoTemplate::factory()->create();
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::TemplateSelected,
        'photo_template_id' => $template->id,
        'sticker_design_id' => null,
    ]);

    $response = $this->postJson(route('kiosk.sessions.sticker.store', $session->session_token), [
        'stickerDesignId' => $sticker->id,
    ]);

    $response->assertStatus(422);

    expect($session->fresh()->sticker_design_id)->toBeNull();
});

test('selecting a sticker before a template has been chosen is rejected', function () {
    $sticker = StickerDesign::factory()->create();
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Paid,
        'photo_template_id' => null,
        'sticker_design_id' => null,
    ]);

    $response = $this->postJson(route('kiosk.sessions.sticker.store', $session->session_token), [
        'stickerDesignId' => $sticker->id,
    ]);

    $response->assertStatus(422);

    expect($session->fresh()->sticker_design_id)->toBeNull();
});

test('selecting a sticker on an expired session is rejected', function () {
    $sticker = StickerDesign::factory()->create();
    $template = PhotoTemplate::factory()->create();
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::TemplateSelected,
        'photo_template_id' => $template->id,
        'sticker_design_id' => null,
        'expires_at' => now()->subMinute(),
    ]);

    $response = $this->postJson(route('kiosk.sessions.sticker.store', $session->session_token), [
        'stickerDesignId' => $sticker->id,
    ]);

    $response->assertStatus(422);

    expect($session->fresh()->sticker_design_id)->toBeNull()
        ->and($session->fresh()->status)->toBe(PhotoboothSessionStatus::Expired);
});

test('selecting a sticker for an unknown session returns not found', function () {
    $sticker = StickerDesign::factory()->create();

    $response = $this->postJson(route('kiosk.sessions.sticker.store', (string) Str::uuid()), [
        'stickerDesignId' => $sticker->id,
    ]);

    $response->assertNotFound();
});
