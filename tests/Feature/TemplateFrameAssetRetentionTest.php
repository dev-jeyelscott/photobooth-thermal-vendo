<?php

use App\Enums\PhotoboothSessionStatus;
use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * Build one valid canonical single-slot layout payload.
 */
function templateFrameRetentionLayoutJson(): string
{
    return json_encode([
        'slots' => [
            [
                'slot' => 1,
                'x' => 0,
                'y' => 0,
                'width' => 100,
                'height' => 150,
            ],
        ],
    ], JSON_THROW_ON_ERROR);
}

/**
 * Submit a valid admin template update that replaces only the layout frame.
 */
function replaceTemplateFrame(
    User $user,
    PhotoTemplate $template,
): void {
    test()
        ->actingAs($user)
        ->post(
            route(
                'admin.templates.update',
                $template,
            ),
            [
                '_method' => 'PUT',
                'name' => $template->name,
                'slug' => $template->slug,
                'orientation' => 'portrait',
                'layout' => UploadedFile::fake()->image(
                    'replacement-frame.png',
                ),
                'photo_slots' => 1,
                'layout_config' => templateFrameRetentionLayoutJson(),
                'print_width_mm' => 100,
                'print_height_mm' => 150,
                'active' => '1',
                'sort_order' => 0,
            ],
        )
        ->assertRedirect(
            route('admin.templates.index'),
        );
}

test('replacing a selected template frame preserves the snapshotted immutable asset', function () {
    Storage::fake('public');

    $user = User::factory()->create();

    $template = PhotoTemplate::factory()->create([
        'layout_path' => 'templates/original-frame.png',
        'orientation' => 'portrait',
        'photo_slots' => 1,
        'layout_config' => [
            'slots' => [
                [
                    'slot' => 1,
                    'x' => 0,
                    'y' => 0,
                    'width' => 100,
                    'height' => 150,
                ],
            ],
        ],
        'print_width_mm' => 100,
        'print_height_mm' => 150,
    ]);

    Storage::disk('public')->put(
        $template->layout_path,
        'original-frame',
    );

    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Paid,
        'photo_template_id' => null,
    ]);

    $this->postJson(
        kioskSessionRoute('kiosk.sessions.template.store', $session->session_token,
        ),
        ['photoTemplateId' => $template->id],
    )->assertOk();

    $oldLayoutPath = $template->layout_path;

    replaceTemplateFrame(
        $user,
        $template,
    );

    $template->refresh();
    $session->refresh();

    expect($template->layout_path)
        ->not->toBe($oldLayoutPath)
        ->and($session->template_snapshot['layout_path'])
        ->toBe($oldLayoutPath);

    Storage::disk('public')->assertExists(
        $oldLayoutPath,
    );

    Storage::disk('public')->assertExists(
        $template->layout_path,
    );
});

test('replacing a frame backfills the old path into an active legacy snapshot before mutation', function () {
    Storage::fake('public');

    $user = User::factory()->create();

    $template = PhotoTemplate::factory()->create([
        'layout_path' => 'templates/legacy-frame.png',
        'orientation' => 'portrait',
        'photo_slots' => 1,
        'layout_config' => [
            'slots' => [
                [
                    'slot' => 1,
                    'x' => 0,
                    'y' => 0,
                    'width' => 100,
                    'height' => 150,
                ],
            ],
        ],
        'print_width_mm' => 100,
        'print_height_mm' => 150,
    ]);

    Storage::disk('public')->put(
        $template->layout_path,
        'legacy-frame',
    );

    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Customizing,
        'photo_template_id' => $template->id,
        'template_snapshot' => [
            'name' => $template->name,
            'layout_config' => $template->layout_config,
            'photo_slots' => 1,
            'print_width_mm' => 100,
            'print_height_mm' => 150,
        ],
    ]);

    $oldLayoutPath = $template->layout_path;

    replaceTemplateFrame(
        $user,
        $template,
    );

    $session->refresh();

    expect(
        $session->template_snapshot['layout_path'],
    )->toBe($oldLayoutPath);

    Storage::disk('public')->assertExists(
        $oldLayoutPath,
    );
});
