<?php

use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use App\Models\StickerDesign;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

test('sticker management exposes the expected Laravel route contract', function () {
    $expectations = [
        'admin.stickers.index' => ['admin/stickers', ['GET', 'HEAD']],
        'admin.stickers.create' => ['admin/stickers/create', ['GET', 'HEAD']],
        'admin.stickers.store' => ['admin/stickers', ['POST']],
        'admin.stickers.edit' => ['admin/stickers/{sticker}/edit', ['GET', 'HEAD']],
        'admin.stickers.update' => ['admin/stickers/{sticker}', ['PUT', 'PATCH']],
        'admin.stickers.destroy' => ['admin/stickers/{sticker}', ['DELETE']],
        'admin.stickers.reorder' => ['admin/stickers/reorder', ['PATCH']],
        'admin.stickers.toggle' => ['admin/stickers/{sticker}/toggle', ['PATCH']],
    ];

    foreach ($expectations as $name => [$uri, $methods]) {
        $route = Route::getRoutes()->getByName($name);

        expect($route)->not->toBeNull();

        if ($route === null) {
            continue;
        }

        expect($route->uri())->toBe($uri)
            ->and($route->methods())->toBe($methods);
    }
});

test('sticker management routes require authentication', function () {
    $sticker = StickerDesign::factory()->create();

    $this->get(route('admin.stickers.index'))->assertRedirect(route('login'));
    $this->get(route('admin.stickers.create'))->assertRedirect(route('login'));
    $this->get(route('admin.stickers.edit', $sticker))->assertRedirect(route('login'));
});

test('admin can list all stickers with their active state and public asset urls', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $active = StickerDesign::factory()->create([
        'name' => 'Active Sticker',
        'sort_order' => 0,
        'asset_path' => 'stickers/active.png',
        'thumbnail_path' => 'stickers/thumbnails/active.png',
    ]);
    $inactive = StickerDesign::factory()->inactive()->create([
        'name' => 'Inactive Sticker',
        'sort_order' => 1,
        'asset_path' => 'stickers/inactive.png',
        'thumbnail_path' => null,
    ]);

    $response = $this->actingAs($user)->get(route('admin.stickers.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/stickers/index')
        ->where('stickers.0.id', $active->id)
        ->where('stickers.0.name', $active->name)
        ->where('stickers.0.active', true)
        ->where('stickers.0.assetUrl', Storage::disk('public')->url($active->asset_path))
        ->where('stickers.0.thumbnailUrl', Storage::disk('public')->url($active->thumbnail_path))
        ->where('stickers.1.id', $inactive->id)
        ->where('stickers.1.name', $inactive->name)
        ->where('stickers.1.active', false)
        ->where('stickers.1.assetUrl', Storage::disk('public')->url($inactive->asset_path))
        ->where('stickers.1.thumbnailUrl', null)
    );
});

test('admin edit receives the selected sticker, compatibility, and public asset urls', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $template = PhotoTemplate::factory()->create();
    $sticker = StickerDesign::factory()->compatibleWith($template)->create([
        'asset_path' => 'stickers/party-hat.png',
        'thumbnail_path' => 'stickers/thumbnails/party-hat.png',
    ]);

    $response = $this->actingAs($user)->get(route('admin.stickers.edit', $sticker));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/stickers/edit')
        ->where('sticker.id', $sticker->id)
        ->where('sticker.name', $sticker->name)
        ->where('sticker.assetPath', $sticker->asset_path)
        ->where('sticker.assetUrl', Storage::disk('public')->url($sticker->asset_path))
        ->where('sticker.thumbnailPath', $sticker->thumbnail_path)
        ->where('sticker.thumbnailUrl', Storage::disk('public')->url($sticker->thumbnail_path))
        ->where('sticker.templateIds.0', $template->id)
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

test('admin can explicitly create an inactive sticker', function () {
    Storage::fake('public');
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('admin.stickers.store'), [
        'name' => 'Inactive Sticker',
        'asset' => UploadedFile::fake()->image('asset.png'),
        'active' => '0',
    ]);

    $response->assertRedirect(route('admin.stickers.index'));
    expect(StickerDesign::sole()->active)->toBeFalse();
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

test('admin can update through multipart-compatible method spoofing without replacing assets', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $template = PhotoTemplate::factory()->create();
    $sticker = StickerDesign::factory()->create([
        'asset_path' => 'stickers/original.png',
        'thumbnail_path' => 'stickers/thumbnails/original.png',
        'active' => true,
    ]);
    Storage::disk('public')->put($sticker->asset_path, 'asset');
    Storage::disk('public')->put($sticker->thumbnail_path, 'thumbnail');

    $response = $this->actingAs($user)->post(route('admin.stickers.update', $sticker), [
        '_method' => 'PUT',
        'name' => 'Updated Name',
        'active' => '0',
        'sort_order' => 3,
        'template_ids' => [$template->id],
    ]);

    $response->assertRedirect(route('admin.stickers.index'));

    $sticker->refresh();
    expect($sticker->name)->toBe('Updated Name')
        ->and($sticker->active)->toBeFalse()
        ->and($sticker->sort_order)->toBe(3)
        ->and($sticker->asset_path)->toBe('stickers/original.png')
        ->and($sticker->thumbnail_path)->toBe('stickers/thumbnails/original.png')
        ->and($sticker->photoTemplates()->pluck('photo_templates.id')->all())->toBe([$template->id]);

    Storage::disk('public')->assertExists($sticker->asset_path);
    Storage::disk('public')->assertExists($sticker->thumbnail_path);
});

test('admin can replace sticker assets through multipart-compatible method spoofing', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $sticker = StickerDesign::factory()->create([
        'asset_path' => 'stickers/original.png',
        'thumbnail_path' => 'stickers/thumbnails/original.png',
        'name' => 'Old Name',
    ]);
    $oldAssetPath = $sticker->asset_path;
    $oldThumbnailPath = $sticker->thumbnail_path;
    Storage::disk('public')->put($oldAssetPath, 'original-asset');
    Storage::disk('public')->put($oldThumbnailPath, 'original-thumbnail');

    $response = $this->actingAs($user)->post(route('admin.stickers.update', $sticker), [
        '_method' => 'PUT',
        'name' => 'New Name',
        'asset' => UploadedFile::fake()->image('new-asset.png'),
        'thumbnail' => UploadedFile::fake()->image('new-thumbnail.png'),
        'active' => '1',
        'sort_order' => $sticker->sort_order,
    ]);

    $response->assertRedirect(route('admin.stickers.index'));

    $sticker->refresh();
    expect($sticker->name)->toBe('New Name')
        ->and($sticker->asset_path)->not->toBe($oldAssetPath)
        ->and($sticker->thumbnail_path)->not->toBe($oldThumbnailPath);

    Storage::disk('public')->assertMissing($oldAssetPath);
    Storage::disk('public')->assertMissing($oldThumbnailPath);
    Storage::disk('public')->assertExists($sticker->asset_path);
    Storage::disk('public')->assertExists($sticker->thumbnail_path);
});

test('admin can toggle a sticker active flag through the Wayfinder form method spoof', function () {
    $user = User::factory()->create();
    $sticker = StickerDesign::factory()->create(['active' => true]);

    $response = $this->actingAs($user)->post(route('admin.stickers.toggle', $sticker), [
        '_method' => 'PATCH',
    ]);

    $response->assertRedirect(route('admin.stickers.index'));
    expect($sticker->fresh()->active)->toBeFalse();
});

test('admin can reorder stickers and the new order affects public selection', function () {
    $user = User::factory()->create();
    $first = StickerDesign::factory()->create(['name' => 'First', 'sort_order' => 0]);
    $second = StickerDesign::factory()->create(['name' => 'Second', 'sort_order' => 1]);

    $response = $this->actingAs($user)->patch(route('admin.stickers.reorder'), [
        'ordered_ids' => [$second->id, $first->id],
    ]);

    $response->assertRedirect(route('admin.stickers.index'));

    expect($second->fresh()->sort_order)->toBe(0)
        ->and($first->fresh()->sort_order)->toBe(1);

    $adminIndex = $this->actingAs($user)->get(route('admin.stickers.index'));
    $adminIndex->assertInertia(fn ($page) => $page
        ->where('stickers.0.id', $second->id)
        ->where('stickers.1.id', $first->id)
    );

    $publicIndex = $this->getJson(businessRoute('stickers.index'));
    $publicIndex->assertJsonPath('stickers.0.id', $second->id);
    $publicIndex->assertJsonPath('stickers.1.id', $first->id);
});

test('admin can delete an unused sticker and its stored assets through the Wayfinder form method spoof', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $sticker = StickerDesign::factory()->create([
        'asset_path' => 'stickers/delete-me.png',
        'thumbnail_path' => 'stickers/thumbnails/delete-me.png',
    ]);
    $assetPath = $sticker->asset_path;
    $thumbnailPath = $sticker->thumbnail_path;
    Storage::disk('public')->put($assetPath, 'asset');
    Storage::disk('public')->put($thumbnailPath, 'thumbnail');

    $response = $this->actingAs($user)->post(route('admin.stickers.destroy', $sticker), [
        '_method' => 'DELETE',
    ]);

    $response->assertRedirect(route('admin.stickers.index'));
    expect(StickerDesign::find($sticker->id))->toBeNull();
    Storage::disk('public')->assertMissing($assetPath);
    Storage::disk('public')->assertMissing($thumbnailPath);
});

test('deleting a sticker with associated sessions is rejected and preserves assets', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $sticker = StickerDesign::factory()->create([
        'asset_path' => 'stickers/referenced.png',
        'thumbnail_path' => 'stickers/thumbnails/referenced.png',
    ]);
    Storage::disk('public')->put($sticker->asset_path, 'asset');
    Storage::disk('public')->put($sticker->thumbnail_path, 'thumbnail');
    PhotoboothSession::factory()->create(['sticker_design_id' => $sticker->id]);

    $response = $this->actingAs($user)->post(route('admin.stickers.destroy', $sticker), [
        '_method' => 'DELETE',
    ]);

    $response->assertSessionHasErrors('sticker');
    expect(StickerDesign::find($sticker->id))->not->toBeNull();
    Storage::disk('public')->assertExists($sticker->asset_path);
    Storage::disk('public')->assertExists($sticker->thumbnail_path);
});

test('sticker_designs sort_order column is indexed', function () {
    $indexes = collect(Schema::getIndexes('sticker_designs'));

    expect($indexes->contains(fn ($index) => $index['columns'] === ['sort_order']))->toBeTrue();
});
