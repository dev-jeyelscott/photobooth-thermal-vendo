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
