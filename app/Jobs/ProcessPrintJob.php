<?php

namespace App\Jobs;

use App\Enums\PhotoboothSessionStatus;
use App\Enums\PrintJobStatus;
use App\Models\PrintJob;
use App\Services\Printing\PrinterDriver;
use App\Services\Printing\ReceiptRenderer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Drives a PrintJob's Pending/Failed -> Printing -> Printed/Failed lifecycle,
 * rendering the session's receipt and handing it to the configured
 * PrinterDriver, while keeping any adapter failure contained to the
 * PrintJob record instead of the customer-facing session flow.
 */
class ProcessPrintJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public readonly PrintJob $printJob) {}

    public function handle(PrinterDriver $printerDriver, ReceiptRenderer $receiptRenderer): void
    {
        $claimed = DB::transaction(function (): bool {
            $printJob = PrintJob::whereKey($this->printJob->id)->lockForUpdate()->first();

            if (! in_array($printJob->status, [PrintJobStatus::Pending, PrintJobStatus::Failed], true)) {
                return false;
            }

            $printJob->update([
                'status' => PrintJobStatus::Printing,
                'attempt_count' => $printJob->attempt_count + 1,
                'started_at' => now(),
            ]);

            return true;
        });

        if (! $claimed) {
            return;
        }

        $this->printJob->refresh();

        try {
            $capturedMedia = $this->printJob->photoboothSession->capturedMedia()->firstOrFail();

            $receiptPath = $receiptRenderer->render($capturedMedia);

            $printerDriver->send($this->printJob, $receiptPath);

            DB::transaction(function (): void {
                $this->printJob->update([
                    'status' => PrintJobStatus::Printed,
                    'completed_at' => now(),
                ]);

                $this->printJob->photoboothSession->transitionTo(PhotoboothSessionStatus::Completed);
            });
        } catch (Throwable $exception) {
            $this->printJob->update([
                'status' => PrintJobStatus::Failed,
                'last_error' => $exception->getMessage(),
            ]);

            Log::error('Print job failed.', [
                'print_job_id' => $this->printJob->id,
                'photobooth_session_id' => $this->printJob->photobooth_session_id,
                'error' => $exception->getMessage(),
            ]);
        }
    }
}
