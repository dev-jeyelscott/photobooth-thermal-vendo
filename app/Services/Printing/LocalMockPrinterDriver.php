<?php

namespace App\Services\Printing;

use App\Models\PrintJob;
use Illuminate\Support\Facades\Log;

/**
 * Development/test printer driver that records the print attempt instead of
 * talking to real thermal printer hardware.
 */
class LocalMockPrinterDriver implements PrinterDriver
{
    public function send(PrintJob $job, string $imagePath): void
    {
        Log::info('Local mock printer driver received print job.', [
            'print_job_id' => $job->id,
            'photobooth_session_id' => $job->photobooth_session_id,
            'image_path' => $imagePath,
        ]);
    }
}
