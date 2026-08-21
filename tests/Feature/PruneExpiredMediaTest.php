<?php

use App\Models\CapturedMedia;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

test('pruning expired media deletes files but preserves the record', function () {
    Storage::fake('public');

    $capturedMedia = CapturedMedia::factory()->create([
        'expires_at' => now()->subDay(),
    ]);

    Storage::disk('public')->put($capturedMedia->color_path, 'color');
    Storage::disk('public')->put($capturedMedia->bw_path, 'bw');
    Storage::disk('public')->put($capturedMedia->gif_path, 'gif');

    $colorPath = $capturedMedia->color_path;
    $bwPath = $capturedMedia->bw_path;
    $gifPath = $capturedMedia->gif_path;
    $sessionId = $capturedMedia->photobooth_session_id;
    $publicToken = $capturedMedia->public_token;
    $expiresAt = $capturedMedia->expires_at;
    $createdAt = $capturedMedia->created_at;

    Artisan::call('media:prune-expired');

    Storage::disk('public')->assertMissing($colorPath);
    Storage::disk('public')->assertMissing($bwPath);
    Storage::disk('public')->assertMissing($gifPath);

    $capturedMedia->refresh();

    expect($capturedMedia->exists)->toBeTrue();
    expect($capturedMedia->color_path)->toBeNull();
    expect($capturedMedia->bw_path)->toBeNull();
    expect($capturedMedia->gif_path)->toBeNull();
    expect($capturedMedia->photobooth_session_id)->toBe($sessionId);
    expect($capturedMedia->public_token)->toBe($publicToken);
    expect($capturedMedia->expires_at->equalTo($expiresAt))->toBeTrue();
    expect($capturedMedia->created_at->equalTo($createdAt))->toBeTrue();
});

test('gallery still renders the expired state after pruning', function () {
    Storage::fake('public');

    $capturedMedia = CapturedMedia::factory()->create([
        'expires_at' => now()->subDay(),
    ]);

    Artisan::call('media:prune-expired');

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

test('re-running the prune command against already-pruned records is idempotent', function () {
    Storage::fake('public');

    $capturedMedia = CapturedMedia::factory()->create([
        'expires_at' => now()->subDay(),
    ]);

    Artisan::call('media:prune-expired');
    Artisan::call('media:prune-expired');

    $capturedMedia->refresh();

    expect($capturedMedia->exists)->toBeTrue();
    expect($capturedMedia->color_path)->toBeNull();
});

test('a failure deleting one record file is logged and does not halt processing of remaining records', function () {
    $fakeDisk = Storage::fake('public');

    $failing = CapturedMedia::factory()->create([
        'expires_at' => now()->subDay(),
    ]);

    $healthy = CapturedMedia::factory()->create([
        'expires_at' => now()->subDay(),
    ]);

    $failingColorPath = $failing->color_path;

    Storage::shouldReceive('disk')
        ->with('public')
        ->andReturnUsing(function () use ($fakeDisk, $failingColorPath) {
            $mock = Mockery::mock($fakeDisk)->makePartial();

            $mock->shouldReceive('delete')
                ->with($failingColorPath)
                ->andThrow(new RuntimeException('Simulated storage failure.'));

            return $mock;
        });

    Log::spy();

    Artisan::call('media:prune-expired');

    $failing->refresh();
    $healthy->refresh();

    expect($healthy->exists)->toBeTrue();
    expect($healthy->color_path)->toBeNull();
    expect($healthy->bw_path)->toBeNull();
    expect($healthy->gif_path)->toBeNull();

    expect($failing->exists)->toBeTrue();
    expect($failing->color_path)->toBe($failingColorPath);

    Log::shouldHaveReceived('error')
        ->once()
        ->withArgs(function (string $message, array $context) use ($failing, $failingColorPath) {
            return str_contains($message, 'prune')
                && $context['captured_media_id'] === $failing->id
                && $context['path'] === $failingColorPath
                && str_contains($context['error'], 'Simulated storage failure.');
        });
});
