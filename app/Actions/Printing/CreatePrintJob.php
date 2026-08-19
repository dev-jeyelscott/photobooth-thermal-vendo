<?php

namespace App\Actions\Printing;

use App\Enums\PrintJobStatus;
use App\Jobs\ProcessPrintJob;
use App\Models\PhotoboothSession;
use App\Models\PrintJob;

class CreatePrintJob
{
    /**
     * Create a pending print job for the session and queue it for
     * processing by the configured printer driver.
     */
    public function handle(PhotoboothSession $session): PrintJob
    {
        $printJob = $session->printJob()->create([
            'status' => PrintJobStatus::Pending,
            'attempt_count' => 0,
        ]);

        ProcessPrintJob::dispatch($printJob);

        return $printJob;
    }
}
