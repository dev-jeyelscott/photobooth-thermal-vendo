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

test('selecting a sticker snapshots its rendering configuration onto the session', function () {
    $sticker = StickerDesign::factory()->create(['asset_path' => 'stickers/party-hat.png']);
    $template = PhotoTemplate::factory()->create();
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::TemplateSelected,
        'photo_template_id' => $template->id,
        'sticker_design_id' => null,
    ]);

    $this->postJson(route('kiosk.sessions.sticker.store', $session->session_token), [
        'stickerDesignId' => $sticker->id,
    ])->assertOk();

    expect($session->fresh()->sticker_snapshot)->toBe(['asset_path' => 'stickers/party-hat.png']);
});

test('editing the sticker after selection does not alter the session\'s stored snapshot', function () {
    $sticker = StickerDesign::factory()->create(['asset_path' => 'stickers/party-hat.png']);
    $template = PhotoTemplate::factory()->create();
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::TemplateSelected,
        'photo_template_id' => $template->id,
        'sticker_design_id' => null,
    ]);

    $this->postJson(route('kiosk.sessions.sticker.store', $session->session_token), [
        'stickerDesignId' => $sticker->id,
    ])->assertOk();

    $sticker->update(['asset_path' => 'stickers/updated.png']);

    expect($session->fresh()->sticker_snapshot)->toBe(['asset_path' => 'stickers/party-hat.png']);
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

test('the sticker list is scoped to stickers compatible with the session\'s selected template', function () {
    $template = PhotoTemplate::factory()->create();
    $otherTemplate = PhotoTemplate::factory()->create();
    $compatible = StickerDesign::factory()->create(['name' => 'Compatible']);
    $compatible->photoTemplates()->attach($template);
    $incompatible = StickerDesign::factory()->create(['name' => 'Incompatible']);
    $incompatible->photoTemplates()->attach($otherTemplate);
    $universal = StickerDesign::factory()->create(['name' => 'Universal']);
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::TemplateSelected,
        'photo_template_id' => $template->id,
    ]);

    $response = $this->getJson(route('stickers.index', ['sessionToken' => $session->session_token]));

    $response->assertOk();
    $names = collect($response->json('stickers'))->pluck('name');

    expect($names)->toContain('Compatible')
        ->toContain('Universal')
        ->not->toContain('Incompatible');
});

test('the sticker list is unfiltered when the session has not selected a template', function () {
    $otherTemplate = PhotoTemplate::factory()->create();
    $restricted = StickerDesign::factory()->create();
    $restricted->photoTemplates()->attach($otherTemplate);
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Paid,
        'photo_template_id' => null,
    ]);

    $response = $this->getJson(route('stickers.index', ['sessionToken' => $session->session_token]));

    $response->assertOk();
    expect($response->json('stickers'))->toHaveCount(1);
});

test('selecting a sticker that is not compatible with the session\'s selected template is rejected', function () {
    $template = PhotoTemplate::factory()->create();
    $otherTemplate = PhotoTemplate::factory()->create();
    $incompatibleSticker = StickerDesign::factory()->create();
    $incompatibleSticker->photoTemplates()->attach($otherTemplate);
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::TemplateSelected,
        'photo_template_id' => $template->id,
        'sticker_design_id' => null,
    ]);

    $response = $this->postJson(route('kiosk.sessions.sticker.store', $session->session_token), [
        'stickerDesignId' => $incompatibleSticker->id,
    ]);

    $response->assertStatus(422);

    expect($session->fresh()->sticker_design_id)->toBeNull();
});

test('selecting a sticker with no compatible-template restrictions is accepted for any template', function () {
    $template = PhotoTemplate::factory()->create();
    $universalSticker = StickerDesign::factory()->create();
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::TemplateSelected,
        'photo_template_id' => $template->id,
        'sticker_design_id' => null,
    ]);

    $response = $this->postJson(route('kiosk.sessions.sticker.store', $session->session_token), [
        'stickerDesignId' => $universalSticker->id,
    ]);

    $response->assertOk();

    expect($session->fresh()->sticker_design_id)->toBe($universalSticker->id);
});

test('selecting a sticker for an unknown session returns not found', function () {
    $sticker = StickerDesign::factory()->create();

    $response = $this->postJson(route('kiosk.sessions.sticker.store', (string) Str::uuid()), [
        'stickerDesignId' => $sticker->id,
    ]);

    $response->assertNotFound();
});
