<?php

use App\Models\CapturedMedia;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

test('a valid gallery token renders protected color black and white and gif asset URLs', function () {
    Storage::fake('public');

    $capturedMedia = CapturedMedia::factory()->create([
        'expires_at' => now()->addDay(),
    ]);

    $response = $this->get(route('gallery.show', $capturedMedia->public_token));

    $response->assertOk();
    $response->assertInertia(fn (Assert $page) => $page
        ->component('gallery')
        ->where('colorUrl', route('gallery.media', [
            'capturedMedia' => $capturedMedia->public_token,
            'variant' => 'color',
        ]))
        ->where('bwUrl', route('gallery.media', [
            'capturedMedia' => $capturedMedia->public_token,
            'variant' => 'bw',
        ]))
        ->where('gifUrl', route('gallery.media', [
            'capturedMedia' => $capturedMedia->public_token,
            'variant' => 'gif',
        ]))
        ->where('expiresAt', $capturedMedia->expires_at->toIso8601String())
        ->missing('id')
        ->missing('photoboothSessionId')
        ->missing('photobooth_session_id')
    );

    $response->assertDontSee('/storage/captures/', false);
    $response->assertDontSee('"id":'.$capturedMedia->id, false);
    $response->assertDontSee('"photobooth_session_id":'.$capturedMedia->photobooth_session_id, false);
});

test('gallery media streams only the recorded unexpired capture variants', function (string $variant, string $path, string $contentType, string $content) {
    Storage::fake('public');

    $capturedMedia = CapturedMedia::factory()->create([
        'color_path' => 'captures/gallery-color.jpg',
        'bw_path' => 'captures/gallery-bw.jpg',
        'gif_path' => 'captures/gallery-animation.gif',
        'expires_at' => now()->addDay(),
    ]);

    Storage::disk('public')->put($path, $content);

    $response = $this->get(route('gallery.media', [
        'capturedMedia' => $capturedMedia->public_token,
        'variant' => $variant,
    ]));

    $response->assertOk();
    $response->assertHeader('Content-Type', $contentType);
    $response->assertHeader('X-Content-Type-Options', 'nosniff');
    $response->assertHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    $response->assertStreamedContent($content);

    expect($response->headers->get('Cache-Control'))
        ->toContain('private')
        ->toContain('no-store');
})->with([
    'color' => ['color', 'captures/gallery-color.jpg', 'image/jpeg', 'color-image'],
    'black and white' => ['bw', 'captures/gallery-bw.jpg', 'image/jpeg', 'bw-image'],
    'gif' => ['gif', 'captures/gallery-animation.gif', 'image/gif', 'gif-image'],
]);

test('gallery media returns not found after the gallery expires', function () {
    Storage::fake('public');

    $capturedMedia = CapturedMedia::factory()->create([
        'color_path' => 'captures/expired-color.jpg',
        'expires_at' => now()->subMinute(),
    ]);

    Storage::disk('public')->put($capturedMedia->color_path, 'expired-image');

    $this->get(route('gallery.media', [
        'capturedMedia' => $capturedMedia->public_token,
        'variant' => 'color',
    ]))->assertNotFound();
});

test('gallery media rejects unsupported variants', function () {
    $capturedMedia = CapturedMedia::factory()->create([
        'expires_at' => now()->addDay(),
    ]);

    $this->get(route('gallery.media', [
        'capturedMedia' => $capturedMedia->public_token,
        'variant' => 'receipt',
    ]))->assertNotFound();
});

test('gallery media rejects missing generated files', function () {
    Storage::fake('public');

    $capturedMedia = CapturedMedia::factory()->create([
        'color_path' => 'captures/missing-color.jpg',
        'expires_at' => now()->addDay(),
    ]);

    $this->get(route('gallery.media', [
        'capturedMedia' => $capturedMedia->public_token,
        'variant' => 'color',
    ]))->assertNotFound();
});

test('gallery media never serves a recorded path outside the captures namespace', function () {
    Storage::fake('public');

    $capturedMedia = CapturedMedia::factory()->create([
        'color_path' => 'templates/not-customer-media.png',
        'expires_at' => now()->addDay(),
    ]);

    Storage::disk('public')->put($capturedMedia->color_path, 'public-template');

    $this->get(route('gallery.media', [
        'capturedMedia' => $capturedMedia->public_token,
        'variant' => 'color',
    ]))->assertNotFound();
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
    }
});
