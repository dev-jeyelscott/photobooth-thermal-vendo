<?php

use App\Enums\PhotoboothSessionStatus;
use App\Enums\PrintJobStatus;
use App\Jobs\ProcessPrintJob;
use App\Models\CapturedMedia;
use App\Models\PhotoboothSession;
use App\Models\PrintJob;
use App\Services\Printing\PrinterDriver;
use App\Services\Printing\ReceiptRenderer;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

function processPrintJobFixturePng(): string
{
    $image = imagecreatetruecolor(200, 100);
    imagefill($image, 0, 0, (int) imagecolorallocate($image, 128, 128, 128));
    ob_start();
    imagepng($image);
    imagedestroy($image);

    return ob_get_clean();
}

function makePrintableSession(): PrintJob
{
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Printing,
    ]);

    CapturedMedia::factory()->create([
        'photobooth_session_id' => $session->id,
        'bw_path' => 'captures/fixture-bw.png',
    ]);

    Storage::disk('public')->put('captures/fixture-bw.png', processPrintJobFixturePng());

    return PrintJob::factory()->for($session, 'photoboothSession')->create();
}

test('a successful print run transitions pending through printing to printed', function () {
    Storage::fake('public');
    $printJob = makePrintableSession();

    (new ProcessPrintJob($printJob))->handle(app(PrinterDriver::class), app(ReceiptRenderer::class));

    $printJob->refresh();

    expect($printJob->status)->toBe(PrintJobStatus::Printed)
        ->and($printJob->attempt_count)->toBe(1)
        ->and($printJob->completed_at)->not->toBeNull()
        ->and($printJob->last_error)->toBeNull()
        ->and($printJob->photoboothSession->fresh()->status)->toBe(PhotoboothSessionStatus::Completed);
});

test('a failure completing the session leaves the print job and session state unchanged', function () {
    Storage::fake('public');
    $printJob = makePrintableSession();

    $session = $printJob->photoboothSession;
    $session->update(['status' => PhotoboothSessionStatus::Completed]);

    (new ProcessPrintJob($printJob))->handle(app(PrinterDriver::class), app(ReceiptRenderer::class));

    $printJob->refresh();

    expect($printJob->status)->toBe(PrintJobStatus::Failed)
        ->and($printJob->completed_at)->toBeNull()
        ->and($printJob->last_error)->not->toBeNull()
        ->and($session->fresh()->status)->toBe(PhotoboothSessionStatus::Completed);
});

test('a failing printer driver records the error and marks the job failed without throwing', function () {
    Storage::fake('public');
    $printJob = makePrintableSession();

    $failingDriver = new class implements PrinterDriver
    {
        public function send(PrintJob $job, string $imagePath): void
        {
            throw new RuntimeException('Printer offline');
        }
    };

    $job = new ProcessPrintJob($printJob);
    $job->handle($failingDriver, app(ReceiptRenderer::class));

    $printJob->refresh();

    expect($printJob->status)->toBe(PrintJobStatus::Failed)
        ->and($printJob->attempt_count)->toBe(1)
        ->and($printJob->last_error)->toBe('Printer offline')
        ->and($printJob->completed_at)->toBeNull();
});

test('retrying a failed print job attempts printing again and can succeed', function () {
    Storage::fake('public');
    $printJob = makePrintableSession();

    $failingDriver = new class implements PrinterDriver
    {
        public function send(PrintJob $job, string $imagePath): void
        {
            throw new RuntimeException('Printer offline');
        }
    };

    (new ProcessPrintJob($printJob))->handle($failingDriver, app(ReceiptRenderer::class));

    $printJob->refresh();
    expect($printJob->status)->toBe(PrintJobStatus::Failed)
        ->and($printJob->attempt_count)->toBe(1);

    Queue::fake();
    Artisan::call('print-jobs:retry', ['printJob' => $printJob->id]);
    Queue::assertPushed(ProcessPrintJob::class, fn (ProcessPrintJob $dispatched): bool => $dispatched->printJob->is($printJob));

    (new ProcessPrintJob($printJob))->handle(app(PrinterDriver::class), app(ReceiptRenderer::class));

    $printJob->refresh();

    expect($printJob->status)->toBe(PrintJobStatus::Printed)
        ->and($printJob->attempt_count)->toBe(2)
        ->and($printJob->completed_at)->not->toBeNull();
});

test('re-dispatching an already-printed job does not attempt to print again or re-increment attempt_count', function () {
    Storage::fake('public');
    $printJob = makePrintableSession();

    (new ProcessPrintJob($printJob))->handle(app(PrinterDriver::class), app(ReceiptRenderer::class));

    $printJob->refresh();
    expect($printJob->status)->toBe(PrintJobStatus::Printed)
        ->and($printJob->attempt_count)->toBe(1);
    $firstCompletedAt = $printJob->completed_at;

    $countingDriver = new class implements PrinterDriver
    {
        public int $sendCount = 0;

        public function send(PrintJob $job, string $imagePath): void
        {
            $this->sendCount++;
        }
    };

    (new ProcessPrintJob($printJob))->handle($countingDriver, app(ReceiptRenderer::class));

    $printJob->refresh();

    expect($countingDriver->sendCount)->toBe(0)
        ->and($printJob->status)->toBe(PrintJobStatus::Printed)
        ->and($printJob->attempt_count)->toBe(1)
        ->and($printJob->completed_at)->toEqual($firstCompletedAt);
});

test('each print attempt records a started_at timestamp independently of completed_at', function () {
    Storage::fake('public');
    $printJob = makePrintableSession();

    $failingDriver = new class implements PrinterDriver
    {
        public function send(PrintJob $job, string $imagePath): void
        {
            throw new RuntimeException('Printer offline');
        }
    };

    (new ProcessPrintJob($printJob))->handle($failingDriver, app(ReceiptRenderer::class));

    $printJob->refresh();
    $firstStartedAt = $printJob->started_at;

    expect($firstStartedAt)->not->toBeNull()
        ->and($printJob->completed_at)->toBeNull();

    Queue::fake();
    Artisan::call('print-jobs:retry', ['printJob' => $printJob->id]);

    (new ProcessPrintJob($printJob))->handle(app(PrinterDriver::class), app(ReceiptRenderer::class));

    $printJob->refresh();

    expect($printJob->status)->toBe(PrintJobStatus::Printed)
        ->and($printJob->attempt_count)->toBe(2)
        ->and($printJob->started_at)->not->toBeNull()
        ->and($printJob->started_at->ne($firstStartedAt))->toBeTrue()
        ->and($printJob->completed_at)->not->toBeNull();
});

test('retrying a print job that is not failed is rejected', function () {
    Storage::fake('public');
    $printJob = makePrintableSession();

    Queue::fake();
    Artisan::call('print-jobs:retry', ['printJob' => $printJob->id]);

    Queue::assertNotPushed(ProcessPrintJob::class);
});
