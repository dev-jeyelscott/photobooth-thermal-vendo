<?php

use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

/**
 * Build a valid deterministic template layout configuration for management tests.
 */
function templateManagementLayoutConfigJson(
    int $slotCount = 3,
    int $printWidth = 100,
    int $printHeight = 150,
): string {
    $slots = [];
    $baseHeight = intdiv($printHeight, $slotCount);
    $remainder = $printHeight % $slotCount;
    $currentY = 0;

    for ($index = 0; $index < $slotCount; $index++) {
        $height = $baseHeight + ($index < $remainder ? 1 : 0);

        $slots[] = [
            'slot' => $index + 1,
            'x' => 0,
            'y' => $currentY,
            'width' => $printWidth,
            'height' => $height,
        ];

        $currentY += $height;
    }

    return json_encode(['slots' => $slots], JSON_THROW_ON_ERROR);
}

test('template management exposes the expected Laravel route contract', function () {
    $expectations = [
        'admin.templates.index' => ['admin/templates', ['GET', 'HEAD']],
        'admin.templates.create' => ['admin/templates/create', ['GET', 'HEAD']],
        'admin.templates.store' => ['admin/templates', ['POST']],
        'admin.templates.edit' => ['admin/templates/{template}/edit', ['GET', 'HEAD']],
        'admin.templates.update' => ['admin/templates/{template}', ['PUT', 'PATCH']],
        'admin.templates.destroy' => ['admin/templates/{template}', ['DELETE']],
        'admin.templates.reorder' => ['admin/templates/reorder', ['PATCH']],
        'admin.templates.toggle' => ['admin/templates/{template}/toggle', ['PATCH']],
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

test('template management routes require authentication', function () {
    $template = PhotoTemplate::factory()->create();

    $this->get(route('admin.templates.index'))->assertRedirect(route('login'));
    $this->get(route('admin.templates.create'))->assertRedirect(route('login'));
    $this->get(route('admin.templates.edit', $template))->assertRedirect(route('login'));
});

test('admin can list all templates with their active state', function () {
    $user = User::factory()->create();
    $active = PhotoTemplate::factory()->create([
        'name' => 'Active Template',
        'sort_order' => 0,
    ]);
    $inactive = PhotoTemplate::factory()->inactive()->create([
        'name' => 'Inactive Template',
        'sort_order' => 1,
    ]);

    $response = $this->actingAs($user)->get(route('admin.templates.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/templates/index')
        ->where('templates.0.id', $active->id)
        ->where('templates.0.name', $active->name)
        ->where('templates.0.active', true)
        ->where('templates.1.id', $inactive->id)
        ->where('templates.1.name', $inactive->name)
        ->where('templates.1.active', false)
    );
});

test('admin edit receives the selected template assets layout configuration and metadata', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $template = PhotoTemplate::factory()->create([
        'layout_path' => 'templates/layout.png',
        'thumbnail_path' => 'templates/thumbnails/thumb.png',
    ]);

    $response = $this->actingAs($user)->get(route('admin.templates.edit', $template));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/templates/edit')
        ->where('template.id', $template->id)
        ->where('template.name', $template->name)
        ->where('template.slug', $template->slug)
        ->where('template.orientation', $template->orientation)
        ->where('template.layoutPath', $template->layout_path)
        ->where('template.layoutUrl', Storage::disk('public')->url($template->layout_path))
        ->where('template.thumbnailPath', $template->thumbnail_path)
        ->where('template.thumbnailUrl', Storage::disk('public')->url($template->thumbnail_path))
        ->where('template.layoutConfig', $template->layout_config)
        ->where('template.createdAt', $template->created_at?->toIso8601String())
        ->where('template.updatedAt', $template->updated_at?->toIso8601String())
    );
});

test('admin can create a template with assets and canonical layout configuration', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $layoutConfig = templateManagementLayoutConfigJson(3, 100, 150);

    $response = $this->actingAs($user)->post(route('admin.templates.store'), [
        'name' => 'Classic Strip',
        'slug' => 'classic-strip',
        'orientation' => 'portrait',
        'layout' => UploadedFile::fake()->image('layout.png'),
        'thumbnail' => UploadedFile::fake()->image('thumb.png'),
        'photo_slots' => 3,
        'layout_config' => $layoutConfig,
        'print_width_mm' => 100,
        'print_height_mm' => 150,
        'active' => '1',
        'sort_order' => 2,
    ]);

    $response->assertRedirect(route('admin.templates.index'));

    $template = PhotoTemplate::sole();

    expect($template->name)->toBe('Classic Strip')
        ->and($template->slug)->toBe('classic-strip')
        ->and($template->orientation)->toBe('portrait')
        ->and($template->photo_slots)->toBe(3)
        ->and($template->layout_config)->toBe(
            json_decode($layoutConfig, true, flags: JSON_THROW_ON_ERROR),
        )
        ->and($template->active)->toBeTrue()
        ->and($template->sort_order)->toBe(2);

    Storage::disk('public')->assertExists($template->layout_path);
    Storage::disk('public')->assertExists($template->thumbnail_path);
});

test('admin can explicitly create an inactive template', function () {
    Storage::fake('public');
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('admin.templates.store'), [
        'name' => 'Inactive Strip',
        'slug' => 'inactive-strip',
        'orientation' => 'portrait',
        'layout' => UploadedFile::fake()->image('layout.png'),
        'photo_slots' => 3,
        'layout_config' => templateManagementLayoutConfigJson(3, 100, 150),
        'print_width_mm' => 100,
        'print_height_mm' => 150,
        'active' => '0',
        'sort_order' => 0,
    ]);

    $response->assertRedirect(route('admin.templates.index'));

    expect(PhotoTemplate::sole()->active)->toBeFalse();
});

test('template creation requires a layout and validates printer compatibility json', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('admin.templates.store'), [
        'name' => 'Invalid Template',
        'slug' => 'invalid-template',
        'orientation' => 'portrait',
        'photo_slots' => 3,
        'layout_config' => templateManagementLayoutConfigJson(3, 100, 150),
        'print_width_mm' => 100,
        'print_height_mm' => 150,
        'active' => '1',
        'printer_compatibility' => '{invalid-json}',
    ]);

    $response->assertSessionHasErrors([
        'layout',
        'printer_compatibility',
    ]);

    expect(PhotoTemplate::query()->count())->toBe(0);
});

test('template creation rejects malformed layout configuration json', function () {
    Storage::fake('public');
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('admin.templates.store'), [
        'name' => 'Malformed Layout',
        'slug' => 'malformed-layout',
        'orientation' => 'portrait',
        'layout' => UploadedFile::fake()->image('layout.png'),
        'photo_slots' => 1,
        'layout_config' => '{invalid-json}',
        'print_width_mm' => 100,
        'print_height_mm' => 150,
        'active' => '1',
    ]);

    $response->assertSessionHasErrors('layout_config');

    expect(PhotoTemplate::query()->count())->toBe(0);
});

test('template creation rejects slots outside the configured print area', function () {
    Storage::fake('public');
    $user = User::factory()->create();

    $invalidLayout = json_encode([
        'slots' => [
            [
                'slot' => 1,
                'x' => 90,
                'y' => 0,
                'width' => 20,
                'height' => 50,
            ],
        ],
    ], JSON_THROW_ON_ERROR);

    $response = $this->actingAs($user)->post(route('admin.templates.store'), [
        'name' => 'Out of Bounds',
        'slug' => 'out-of-bounds',
        'orientation' => 'portrait',
        'layout' => UploadedFile::fake()->image('layout.png'),
        'photo_slots' => 1,
        'layout_config' => $invalidLayout,
        'print_width_mm' => 100,
        'print_height_mm' => 150,
        'active' => '1',
    ]);

    $response->assertSessionHasErrors('layout_config');

    expect(PhotoTemplate::query()->count())->toBe(0);
});

test('template creation rejects layout slot count mismatches', function () {
    Storage::fake('public');
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('admin.templates.store'), [
        'name' => 'Mismatched Slots',
        'slug' => 'mismatched-slots',
        'orientation' => 'portrait',
        'layout' => UploadedFile::fake()->image('layout.png'),
        'photo_slots' => 3,
        'layout_config' => templateManagementLayoutConfigJson(2, 100, 150),
        'print_width_mm' => 100,
        'print_height_mm' => 150,
        'active' => '1',
    ]);

    $response->assertSessionHasErrors('layout_config');

    expect(PhotoTemplate::query()->count())->toBe(0);
});

test('admin can update through multipart-compatible method spoofing without replacing assets', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $template = PhotoTemplate::factory()->create([
        'layout_path' => 'templates/original.png',
        'thumbnail_path' => 'templates/thumbnails/original.png',
        'active' => true,
    ]);

    Storage::disk('public')->put($template->layout_path, 'layout');
    Storage::disk('public')->put($template->thumbnail_path, 'thumbnail');

    $layoutConfig = templateManagementLayoutConfigJson(
        $template->photo_slots,
        $template->print_width_mm,
        $template->print_height_mm,
    );

    $response = $this->actingAs($user)->post(route('admin.templates.update', $template), [
        '_method' => 'PUT',
        'name' => 'Updated Name',
        'slug' => $template->slug,
        'orientation' => $template->orientation,
        'photo_slots' => $template->photo_slots,
        'layout_config' => $layoutConfig,
        'print_width_mm' => $template->print_width_mm,
        'print_height_mm' => $template->print_height_mm,
        'active' => '0',
        'sort_order' => $template->sort_order,
    ]);

    $response->assertRedirect(route('admin.templates.index'));

    $template->refresh();

    expect($template->name)->toBe('Updated Name')
        ->and($template->active)->toBeFalse()
        ->and($template->layout_config)->toBe(
            json_decode($layoutConfig, true, flags: JSON_THROW_ON_ERROR),
        )
        ->and($template->layout_path)->toBe('templates/original.png')
        ->and($template->thumbnail_path)->toBe('templates/thumbnails/original.png');

    Storage::disk('public')->assertExists($template->layout_path);
    Storage::disk('public')->assertExists($template->thumbnail_path);
});

test('admin can replace template assets through multipart-compatible method spoofing', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $template = PhotoTemplate::factory()->create([
        'layout_path' => 'templates/original.png',
        'thumbnail_path' => 'templates/thumbnails/original.png',
        'name' => 'Old Name',
    ]);
    $oldLayoutPath = $template->layout_path;
    $oldThumbnailPath = $template->thumbnail_path;

    Storage::disk('public')->put($oldLayoutPath, 'original-layout');
    Storage::disk('public')->put($oldThumbnailPath, 'original-thumbnail');

    $response = $this->actingAs($user)->post(route('admin.templates.update', $template), [
        '_method' => 'PUT',
        'name' => 'New Name',
        'slug' => $template->slug,
        'orientation' => $template->orientation,
        'layout' => UploadedFile::fake()->image('new-layout.png'),
        'thumbnail' => UploadedFile::fake()->image('new-thumbnail.png'),
        'photo_slots' => $template->photo_slots,
        'layout_config' => templateManagementLayoutConfigJson(
            $template->photo_slots,
            $template->print_width_mm,
            $template->print_height_mm,
        ),
        'print_width_mm' => $template->print_width_mm,
        'print_height_mm' => $template->print_height_mm,
        'active' => '1',
        'sort_order' => $template->sort_order,
    ]);

    $response->assertRedirect(route('admin.templates.index'));

    $template->refresh();

    expect($template->name)->toBe('New Name')
        ->and($template->layout_path)->not->toBe($oldLayoutPath)
        ->and($template->thumbnail_path)->not->toBe($oldThumbnailPath);

    Storage::disk('public')->assertMissing($oldLayoutPath);
    Storage::disk('public')->assertMissing($oldThumbnailPath);
    Storage::disk('public')->assertExists($template->layout_path);
    Storage::disk('public')->assertExists($template->thumbnail_path);
});

test('admin can update a template without changing its unique slug', function () {
    $user = User::factory()->create();
    $template = PhotoTemplate::factory()->create();

    $response = $this->actingAs($user)->post(route('admin.templates.update', $template), [
        '_method' => 'PUT',
        'name' => 'Same Slug',
        'slug' => $template->slug,
        'orientation' => $template->orientation,
        'photo_slots' => $template->photo_slots,
        'layout_config' => templateManagementLayoutConfigJson(
            $template->photo_slots,
            $template->print_width_mm,
            $template->print_height_mm,
        ),
        'print_width_mm' => $template->print_width_mm,
        'print_height_mm' => $template->print_height_mm,
        'active' => '1',
        'sort_order' => $template->sort_order,
    ]);

    $response->assertRedirect(route('admin.templates.index'));
    $response->assertSessionHasNoErrors();
});

test('admin can toggle a template active flag', function () {
    $user = User::factory()->create();
    $template = PhotoTemplate::factory()->create(['active' => true]);

    $response = $this->actingAs($user)->patch(route('admin.templates.toggle', $template));

    $response->assertRedirect(route('admin.templates.index'));

    expect($template->fresh()->active)->toBeFalse();
});

test('admin can reorder templates and the new order affects public selection', function () {
    $user = User::factory()->create();
    $first = PhotoTemplate::factory()->create([
        'name' => 'First',
        'sort_order' => 0,
    ]);
    $second = PhotoTemplate::factory()->create([
        'name' => 'Second',
        'sort_order' => 1,
    ]);

    $response = $this->actingAs($user)->patch(route('admin.templates.reorder'), [
        'ordered_ids' => [$second->id, $first->id],
    ]);

    $response->assertRedirect(route('admin.templates.index'));

    expect($second->fresh()->sort_order)->toBe(0)
        ->and($first->fresh()->sort_order)->toBe(1);

    $adminIndex = $this->actingAs($user)->get(route('admin.templates.index'));

    $adminIndex->assertInertia(fn ($page) => $page
        ->where('templates.0.id', $second->id)
        ->where('templates.1.id', $first->id)
    );

    $publicIndex = $this->getJson(businessRoute('templates.index'));

    $publicIndex->assertJsonPath('templates.0.id', $second->id);
    $publicIndex->assertJsonPath('templates.1.id', $first->id);
});

test('admin can delete an unused template and its stored assets', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $template = PhotoTemplate::factory()->create([
        'layout_path' => 'templates/layout.png',
        'thumbnail_path' => 'templates/thumbnails/thumb.png',
    ]);

    $layoutPath = $template->layout_path;
    $thumbnailPath = $template->thumbnail_path;

    Storage::disk('public')->put($layoutPath, 'layout');
    Storage::disk('public')->put($thumbnailPath, 'thumbnail');

    $response = $this->actingAs($user)->delete(route('admin.templates.destroy', $template));

    $response->assertRedirect(route('admin.templates.index'));

    expect(PhotoTemplate::find($template->id))->toBeNull();

    Storage::disk('public')->assertMissing($layoutPath);
    Storage::disk('public')->assertMissing($thumbnailPath);
});

test('deleting a template with associated sessions is rejected and preserves assets', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $template = PhotoTemplate::factory()->create([
        'layout_path' => 'templates/referenced.png',
    ]);

    Storage::disk('public')->put($template->layout_path, 'layout');

    PhotoboothSession::factory()->create([
        'photo_template_id' => $template->id,
    ]);

    $response = $this->actingAs($user)->delete(route('admin.templates.destroy', $template));

    $response->assertSessionHasErrors('template');

    expect(PhotoTemplate::find($template->id))->not->toBeNull();

    Storage::disk('public')->assertExists($template->layout_path);
});

test('photo_templates sort_order column is indexed', function () {
    $indexes = collect(Schema::getIndexes('photo_templates'));

    expect(
        $indexes->contains(
            fn ($index) => $index['columns'] === ['sort_order'],
        ),
    )->toBeTrue();
});
