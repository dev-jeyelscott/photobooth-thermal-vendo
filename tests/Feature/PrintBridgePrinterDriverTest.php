<?php

use App\Models\CapturedMedia;
use App\Models\PhotoboothSession;
use App\Models\PrintJob;
use App\Services\Printing\PrintBridgePrinterDriver;
use App\Services\Printing\PrintBridgeTransport;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

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

test('the print bridge driver sends the receipt image to the configured transport', function () {
    config([
        'photobooth.print_bridge.endpoint' => 'https://print-bridge.test/print',
        'photobooth.print_bridge.timeout_seconds' => 10,
        'photobooth.print_bridge.auth_token' => 'secret-token',
    ]);

    $printJob = makePrintBridgePrintJob();
    $imagePath = printBridgeFixtureImagePath();

    $transport = new class implements PrintBridgeTransport
    {
        public ?array $received = null;

        public function send(
            string $endpoint,
            int $timeoutSeconds,
            ?string $authToken,
            string $imageContents,
            string $imageFilename,
            array $payload,
        ): void {
            $this->received = compact(
                'endpoint',
                'timeoutSeconds',
                'authToken',
                'imageFilename',
                'payload',
            );
        }
    };

    (new PrintBridgePrinterDriver($transport))->send($printJob, $imagePath);

    expect($transport->received)->not->toBeNull();
    expect($transport->received['endpoint'])->toBe('https://print-bridge.test/print');
    expect($transport->received['timeoutSeconds'])->toBe(10);
    expect($transport->received['authToken'])->toBe('secret-token');
    expect($transport->received['payload'])->toBe([
        'print_job_id' => $printJob->id,
        'photobooth_session_id' => $printJob->photobooth_session_id,
    ]);
});

test('the print bridge driver propagates a transport failure', function () {
    config([
        'photobooth.print_bridge.endpoint' => 'https://print-bridge.test/print',
        'photobooth.print_bridge.timeout_seconds' => 10,
        'photobooth.print_bridge.auth_token' => null,
    ]);

    $printJob = makePrintBridgePrintJob();
    $imagePath = printBridgeFixtureImagePath();

    $transport = new class implements PrintBridgeTransport
    {
        public function send(
            string $endpoint,
            int $timeoutSeconds,
            ?string $authToken,
            string $imageContents,
            string $imageFilename,
            array $payload,
        ): void {
            throw new RuntimeException('printer offline');
        }
    };

    expect(fn () => (new PrintBridgePrinterDriver($transport))->send($printJob, $imagePath))
        ->toThrow(RuntimeException::class, 'printer offline');
});

test('the print bridge driver throws when no endpoint is configured', function () {
    config(['photobooth.print_bridge.endpoint' => null]);

    $printJob = makePrintBridgePrintJob();
    $imagePath = printBridgeFixtureImagePath();

    $transport = new class implements PrintBridgeTransport
    {
        public function send(
            string $endpoint,
            int $timeoutSeconds,
            ?string $authToken,
            string $imageContents,
            string $imageFilename,
            array $payload,
        ): void {
            throw new RuntimeException('should not be called');
        }
    };

    expect(fn () => (new PrintBridgePrinterDriver($transport))->send($printJob, $imagePath))
        ->toThrow(RuntimeException::class, 'Print bridge endpoint is not configured.');
});
