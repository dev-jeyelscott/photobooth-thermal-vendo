<?php

use App\Models\PhotoboothSession;
use App\Models\StickerDesign;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

test('sticker management routes require authentication', function () {
    $sticker = StickerDesign::factory()->create();

    $this->get(route('admin.stickers.index'))->assertRedirect(route('login'));
    $this->get(route('admin.stickers.create'))->assertRedirect(route('login'));
    $this->get(route('admin.stickers.edit', $sticker))->assertRedirect(route('login'));
});

test('admin can list all stickers with their active state', function () {
    $user = User::factory()->create();
    $active = StickerDesign::factory()->create(['name' => 'Active Sticker']);
    $inactive = StickerDesign::factory()->inactive()->create(['name' => 'Inactive Sticker']);

    $response = $this->actingAs($user)->get(route('admin.stickers.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/stickers/index')
        ->where('stickers.0.name', $active->name)
        ->where('stickers.0.active', true)
        ->where('stickers.1.name', $inactive->name)
        ->where('stickers.1.active', false)
    );
});

test('admin can create a sticker with asset and thumbnail', function () {
    Storage::fake('public');
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('admin.stickers.store'), [
        'name' => 'Party Hat',
        'asset' => UploadedFile::fake()->image('asset.png'),
        'thumbnail' => UploadedFile::fake()->image('thumb.png'),
        'active' => '1',
    ]);

    $response->assertRedirect(route('admin.stickers.index'));

    $sticker = StickerDesign::sole();
    expect($sticker->name)->toBe('Party Hat')
        ->and($sticker->active)->toBeTrue();

    Storage::disk('public')->assertExists($sticker->asset_path);
    Storage::disk('public')->assertExists($sticker->thumbnail_path);
});

test('admin can create a sticker with valid placement data', function () {
    Storage::fake('public');
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('admin.stickers.store'), [
        'name' => 'Placed Sticker',
        'asset' => UploadedFile::fake()->image('asset.png'),
        'active' => '1',
        'placement' => json_encode(['size_ratio' => 0.2, 'margin_ratio' => 0.05]),
    ]);

    $response->assertRedirect(route('admin.stickers.index'));

    $sticker = StickerDesign::sole();
    expect($sticker->placement)->toBe(['size_ratio' => 0.2, 'margin_ratio' => 0.05]);
});

test('sticker placement JSON that decodes to a scalar is rejected', function () {
    Storage::fake('public');
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('admin.stickers.store'), [
        'name' => 'Bad Placement',
        'asset' => UploadedFile::fake()->image('asset.png'),
        'active' => '1',
        'placement' => json_encode(true),
    ]);

    $response->assertSessionHasErrors('placement');
    expect(StickerDesign::count())->toBe(0);
});

test('sticker placement JSON with non-numeric ratios is rejected', function () {
    Storage::fake('public');
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('admin.stickers.store'), [
        'name' => 'Bad Ratio',
        'asset' => UploadedFile::fake()->image('asset.png'),
        'active' => '1',
        'placement' => json_encode(['size_ratio' => 'huge']),
    ]);

    $response->assertSessionHasErrors('placement');
    expect(StickerDesign::count())->toBe(0);
});

test('admin can edit a sticker and replace its asset', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $sticker = StickerDesign::factory()->create([
        'asset_path' => 'stickers/original.png',
        'name' => 'Old Name',
    ]);
    Storage::disk('public')->put('stickers/original.png', 'original');

    $response = $this->actingAs($user)->put(route('admin.stickers.update', $sticker), [
        'name' => 'New Name',
        'asset' => UploadedFile::fake()->image('new-asset.png'),
        'active' => '1',
    ]);

    $response->assertRedirect(route('admin.stickers.index'));

    $sticker->refresh();
    expect($sticker->name)->toBe('New Name')
        ->and($sticker->asset_path)->not->toBe('stickers/original.png');

    Storage::disk('public')->assertMissing('stickers/original.png');
    Storage::disk('public')->assertExists($sticker->asset_path);
});

test('admin can toggle a sticker active flag', function () {
    $user = User::factory()->create();
    $sticker = StickerDesign::factory()->create(['active' => true]);

    $response = $this->actingAs($user)->patch(route('admin.stickers.toggle', $sticker));

    $response->assertRedirect(route('admin.stickers.index'));
    expect($sticker->fresh()->active)->toBeFalse();
});

test('admin can delete a sticker without associated sessions', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $sticker = StickerDesign::factory()->create();

    $response = $this->actingAs($user)->delete(route('admin.stickers.destroy', $sticker));

    $response->assertRedirect(route('admin.stickers.index'));
    expect(StickerDesign::find($sticker->id))->toBeNull();
});

test('deleting a sticker with associated sessions is rejected', function () {
    $user = User::factory()->create();
    $sticker = StickerDesign::factory()->create();
    PhotoboothSession::factory()->create(['sticker_design_id' => $sticker->id]);

    $response = $this->actingAs($user)->delete(route('admin.stickers.destroy', $sticker));

    $response->assertSessionHasErrors('sticker');
    expect(StickerDesign::find($sticker->id))->not->toBeNull();
});
