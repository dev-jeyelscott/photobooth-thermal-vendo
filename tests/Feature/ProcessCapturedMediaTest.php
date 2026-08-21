<?php

use App\Actions\Processing\ComposeColorPhoto;
use App\Enums\PhotoboothSessionStatus;
use App\Jobs\ProcessCapturedMedia;
use App\Jobs\ProcessPrintJob;
use App\Models\CapturedMedia;
use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use App\Models\PrintJob;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

function processCapturedMediaFixturePng(): string
{
    $image = imagecreatetruecolor(200, 200);
    imagefill($image, 0, 0, imagecolorallocate($image, 200, 50, 50));
    ob_start();
    imagepng($image);
    imagedestroy($image);

    return ob_get_clean();
}

function makeComposableSession(): array
{
    $template = PhotoTemplate::factory()->create([
        'photo_slots' => 2,
        'layout_config' => [
            'slots' => [
                ['slot' => 1, 'x' => 0, 'y' => 0, 'width' => 50, 'height' => 50],
                ['slot' => 2, 'x' => 50, 'y' => 0, 'width' => 50, 'height' => 50],
            ],
        ],
        'print_width_mm' => 100,
        'print_height_mm' => 50,
    ]);

    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Customizing,
        'photo_template_id' => $template->id,
    ]);

    $photo = 'data:image/png;base64,'.base64_encode(processCapturedMediaFixturePng());

    return [$session, [$photo, $photo]];
}

test('the color-output endpoint dispatches a queued job carrying the session and photos instead of processing inline', function () {
    Storage::fake('public');
    Queue::fake();

    [$session, $photos] = makeComposableSession();

    $response = $this->postJson(route('kiosk.sessions.color-output.store', $session->session_token), [
        'photos' => $photos,
    ]);

    $response->assertStatus(202);
    $response->assertJson(['processing' => true]);

    Queue::assertPushed(
        ProcessCapturedMedia::class,
        fn (ProcessCapturedMedia $job): bool => $job->session->is($session)
            && array_map(base64_decode(...), $job->photos) === $photos,
    );

    expect(CapturedMedia::where('photobooth_session_id', $session->id)->exists())->toBeFalse();
});

test('processing the queued job composes the final output and creates exactly one print job', function () {
    Storage::fake('public');
    Queue::fake([ProcessPrintJob::class]);

    [$session, $photos] = makeComposableSession();
    $encodedPhotos = array_map(base64_encode(...), $photos);

    (new ProcessCapturedMedia($session, $encodedPhotos))->handle(app(ComposeColorPhoto::class));

    expect(CapturedMedia::where('photobooth_session_id', $session->id)->count())->toBe(1)
        ->and(PrintJob::where('photobooth_session_id', $session->id)->count())->toBe(1)
        ->and($session->fresh()->status)->toBe(PhotoboothSessionStatus::Printing);
});

test('handling the job twice for the same session is idempotent and produces no duplicate records', function () {
    Storage::fake('public');
    Queue::fake([ProcessPrintJob::class]);

    [$session, $photos] = makeComposableSession();
    $encodedPhotos = array_map(base64_encode(...), $photos);

    $composeColorPhoto = app(ComposeColorPhoto::class);

    (new ProcessCapturedMedia($session, $encodedPhotos))->handle($composeColorPhoto);
    $firstCapturedMedia = CapturedMedia::where('photobooth_session_id', $session->id)->first();
    $firstColorPath = $firstCapturedMedia->color_path;

    (new ProcessCapturedMedia($session->fresh(), $encodedPhotos))->handle($composeColorPhoto);

    expect(CapturedMedia::where('photobooth_session_id', $session->id)->count())->toBe(1)
        ->and(PrintJob::where('photobooth_session_id', $session->id)->count())->toBe(1);

    $secondCapturedMedia = CapturedMedia::where('photobooth_session_id', $session->id)->first();

    expect($secondCapturedMedia->id)->toBe($firstCapturedMedia->id)
        ->and($secondCapturedMedia->color_path)->toBe($firstColorPath);
});

test('a processing failure is logged and rethrown so the queue worker can retry, leaving the session in a customer-recoverable state', function () {
    Storage::fake('public');
    Log::shouldReceive('error')
        ->once()
        ->with('Photo processing failed.', Mockery::on(
            fn (array $context): bool => isset($context['photobooth_session_id'], $context['error']),
        ));

    [$session] = makeComposableSession();

    $invalidPhoto = base64_encode('not-an-image-payload');

    $job = new ProcessCapturedMedia($session, [$invalidPhoto, $invalidPhoto]);

    $threw = false;

    try {
        $job->handle(app(ComposeColorPhoto::class));
    } catch (Throwable) {
        $threw = true;
    }

    expect($threw)->toBeTrue();

    expect($session->fresh()->status)->toBe(PhotoboothSessionStatus::Customizing)
        ->and(CapturedMedia::where('photobooth_session_id', $session->id)->exists())->toBeFalse();
});
