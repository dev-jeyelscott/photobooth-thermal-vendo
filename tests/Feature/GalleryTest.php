<?php

use App\Models\CapturedMedia;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

test('a valid gallery token renders the color, black and white, and gif assets', function () {
    Storage::fake('public');

    $capturedMedia = CapturedMedia::factory()->create();

    $response = $this->get(route('gallery.show', $capturedMedia->public_token));

    $response->assertOk();
    $response->assertInertia(fn (Assert $page) => $page
        ->component('gallery')
        ->where('colorUrl', Storage::disk('public')->url($capturedMedia->color_path))
        ->where('bwUrl', Storage::disk('public')->url($capturedMedia->bw_path))
        ->where('gifUrl', Storage::disk('public')->url($capturedMedia->gif_path))
        ->missing('id')
        ->missing('photoboothSessionId')
        ->missing('photobooth_session_id')
    );

    $response->assertDontSee('"id":'.$capturedMedia->id, false);
    $response->assertDontSee('"photobooth_session_id":'.$capturedMedia->photobooth_session_id, false);
});

test('an unknown gallery token returns not found', function () {
    $response = $this->get(route('gallery.show', (string) Str::random(32)));

    $response->assertNotFound();
});

test('an expired gallery token returns the expired state without serving media', function () {
    Storage::fake('public');

    $capturedMedia = CapturedMedia::factory()->create([
        'expires_at' => now()->subDay(),
    ]);

    $response = $this->get(route('gallery.show', $capturedMedia->public_token));

    $response->assertOk();
    $response->assertInertia(fn (Assert $page) => $page
        ->component('gallery')
        ->where('expired', true)
        ->where('colorUrl', null)
        ->where('bwUrl', null)
        ->where('gifUrl', null)
    );
});

test('gallery tokens are cryptographically random and do not leak sequential ids', function () {
    $mediaItems = CapturedMedia::factory()->count(5)->create();

    $tokens = $mediaItems->pluck('public_token');

    expect($tokens->unique())->toHaveCount(5);

    foreach ($tokens as $token) {
        expect($token)->toHaveLength(32);
        expect($token)->not->toMatch('/^\d+$/');
    }

    foreach ($mediaItems as $capturedMedia) {
        expect($capturedMedia->public_token)->not->toBe((string) $capturedMedia->id);
        expect($capturedMedia->public_token)->not->toBe((string) $capturedMedia->photobooth_session_id);
        expect($capturedMedia->public_token)->not->toStartWith((string) $capturedMedia->id);
    }
});
