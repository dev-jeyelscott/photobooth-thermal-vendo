<?php

use App\Models\CapturedMedia;
use App\Models\PhotoboothSession;
use App\Models\PrintJob;
use App\Services\Printing\PrintBridgePrinterDriver;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

function printBridgeFixtureImagePath(): string
{
    Storage::fake('local');

    $path = Storage::disk('local')->path('print-bridge-fixture.png');

    $image = imagecreatetruecolor(10, 10);
    imagepng($image, $path);
    imagedestroy($image);

    return $path;
}

function makePrintBridgePrintJob(): PrintJob
{
    $session = PhotoboothSession::factory()->create();

    CapturedMedia::factory()->create([
        'photobooth_session_id' => $session->id,
    ]);

    return PrintJob::factory()->for($session, 'photoboothSession')->create();
}

test('the print bridge driver sends the receipt image to the configured endpoint', function () {
    config([
        'photobooth.print_bridge.endpoint' => 'https://print-bridge.test/print',
        'photobooth.print_bridge.timeout_seconds' => 10,
        'photobooth.print_bridge.auth_token' => 'secret-token',
    ]);

    Http::fake([
        'print-bridge.test/*' => Http::response(['status' => 'accepted'], 200),
    ]);

    $printJob = makePrintBridgePrintJob();
    $imagePath = printBridgeFixtureImagePath();

    (new PrintBridgePrinterDriver)->send($printJob, $imagePath);

    Http::assertSent(function ($request) use ($printJob): bool {
        return $request->url() === 'https://print-bridge.test/print'
            && $request->hasHeader('Authorization', 'Bearer secret-token')
            && $request->isMultipart()
            && str_contains($request->body(), (string) $printJob->id);
    });
});

test('the print bridge driver throws when the transport returns an error response', function () {
    config([
        'photobooth.print_bridge.endpoint' => 'https://print-bridge.test/print',
        'photobooth.print_bridge.timeout_seconds' => 10,
        'photobooth.print_bridge.auth_token' => null,
    ]);

    Http::fake([
        'print-bridge.test/*' => Http::response(['error' => 'printer offline'], 503),
    ]);

    $printJob = makePrintBridgePrintJob();
    $imagePath = printBridgeFixtureImagePath();

    expect(fn () => (new PrintBridgePrinterDriver)->send($printJob, $imagePath))
        ->toThrow(RequestException::class);
});

test('the print bridge driver throws when no endpoint is configured', function () {
    config(['photobooth.print_bridge.endpoint' => null]);

    $printJob = makePrintBridgePrintJob();
    $imagePath = printBridgeFixtureImagePath();

    expect(fn () => (new PrintBridgePrinterDriver)->send($printJob, $imagePath))
        ->toThrow(RuntimeException::class);
});
