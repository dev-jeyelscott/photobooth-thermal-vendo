<?php

use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

test('template management routes require authentication', function () {
    $template = PhotoTemplate::factory()->create();

    $this->get(route('admin.templates.index'))->assertRedirect(route('login'));
    $this->get(route('admin.templates.create'))->assertRedirect(route('login'));
    $this->get(route('admin.templates.edit', $template))->assertRedirect(route('login'));
});

test('admin can list all templates with their active state', function () {
    $user = User::factory()->create();
    $active = PhotoTemplate::factory()->create(['name' => 'Active Template']);
    $inactive = PhotoTemplate::factory()->inactive()->create(['name' => 'Inactive Template']);

    $response = $this->actingAs($user)->get(route('admin.templates.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/templates/index')
        ->where('templates.0.name', $active->name)
        ->where('templates.0.active', true)
        ->where('templates.1.name', $inactive->name)
        ->where('templates.1.active', false)
    );
});

test('admin can create a template with layout and thumbnail assets', function () {
    Storage::fake('public');
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('admin.templates.store'), [
        'name' => 'Classic Strip',
        'slug' => 'classic-strip',
        'orientation' => 'portrait',
        'layout' => UploadedFile::fake()->image('layout.png'),
        'thumbnail' => UploadedFile::fake()->image('thumb.png'),
        'photo_slots' => 3,
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
        ->and($template->active)->toBeTrue()
        ->and($template->sort_order)->toBe(2);

    Storage::disk('public')->assertExists($template->layout_path);
    Storage::disk('public')->assertExists($template->thumbnail_path);
});

test('admin can edit a template and replace its layout asset', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $template = PhotoTemplate::factory()->create([
        'layout_path' => 'templates/original.png',
        'name' => 'Old Name',
    ]);
    Storage::disk('public')->put('templates/original.png', 'original');

    $response = $this->actingAs($user)->put(route('admin.templates.update', $template), [
        'name' => 'New Name',
        'slug' => $template->slug,
        'orientation' => $template->orientation,
        'layout' => UploadedFile::fake()->image('new-layout.png'),
        'photo_slots' => $template->photo_slots,
        'print_width_mm' => $template->print_width_mm,
        'print_height_mm' => $template->print_height_mm,
        'active' => '1',
    ]);

    $response->assertRedirect(route('admin.templates.index'));

    $template->refresh();
    expect($template->name)->toBe('New Name')
        ->and($template->layout_path)->not->toBe('templates/original.png');

    Storage::disk('public')->assertMissing('templates/original.png');
    Storage::disk('public')->assertExists($template->layout_path);
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
    $first = PhotoTemplate::factory()->create(['name' => 'First', 'sort_order' => 0]);
    $second = PhotoTemplate::factory()->create(['name' => 'Second', 'sort_order' => 1]);

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

    $publicIndex = $this->getJson(route('templates.index'));
    $publicIndex->assertJsonPath('templates.0.id', $second->id);
    $publicIndex->assertJsonPath('templates.1.id', $first->id);
});

test('admin can delete a template without associated sessions', function () {
    Storage::fake('public');
    $user = User::factory()->create();
    $template = PhotoTemplate::factory()->create();

    $response = $this->actingAs($user)->delete(route('admin.templates.destroy', $template));

    $response->assertRedirect(route('admin.templates.index'));
    expect(PhotoTemplate::find($template->id))->toBeNull();
});

test('deleting a template with associated sessions is rejected', function () {
    $user = User::factory()->create();
    $template = PhotoTemplate::factory()->create();
    PhotoboothSession::factory()->create(['photo_template_id' => $template->id]);

    $response = $this->actingAs($user)->delete(route('admin.templates.destroy', $template));

    $response->assertSessionHasErrors('template');
    expect(PhotoTemplate::find($template->id))->not->toBeNull();
});
