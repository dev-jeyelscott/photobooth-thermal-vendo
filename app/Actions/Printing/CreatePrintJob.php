<?php

namespace App\Actions\Printing;

use App\Enums\PrintJobStatus;
use App\Models\PhotoboothSession;
use App\Models\PrintJob;
use App\Services\Printing\PrinterDriver;

class CreatePrintJob
{
    public function __construct(private readonly PrinterDriver $printerDriver) {}

    /**
     * Create a pending print job for the session's thermal-print-optimized
     * image and dispatch it to the configured printer driver.
     */
    public function handle(PhotoboothSession $session, string $imagePath): PrintJob
    {
        $printJob = $session->printJob()->create([
            'status' => PrintJobStatus::Pending,
            'attempt_count' => 0,
        ]);

        $this->printerDriver->send($printJob, $imagePath);

        return $printJob;
    }
}
