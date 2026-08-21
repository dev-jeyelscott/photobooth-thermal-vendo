<?php

namespace App\Services\Printing;

use App\Models\PrintJob;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Production printer driver that forwards the rendered receipt image to a
 * network print-bridge HTTP service fronting the physical thermal printer,
 * keeping printer hardware details out of the application boundary.
 */
class PrintBridgePrinterDriver implements PrinterDriver
{
    public function send(PrintJob $job, string $imagePath): void
    {
        $endpoint = config('photobooth.print_bridge.endpoint');

        if (empty($endpoint)) {
            throw new RuntimeException('Print bridge endpoint is not configured.');
        }

        $request = Http::timeout((int) config('photobooth.print_bridge.timeout_seconds'));

        $authToken = config('photobooth.print_bridge.auth_token');

        if (! empty($authToken)) {
            $request = $request->withToken($authToken);
        }

        $imageContents = file_get_contents($imagePath);

        if ($imageContents === false) {
            throw new RuntimeException("Unable to read receipt image at [{$imagePath}].");
        }

        $response = $request
            ->attach('image', $imageContents, basename($imagePath))
            ->post($endpoint, [
                'print_job_id' => $job->id,
                'photobooth_session_id' => $job->photobooth_session_id,
            ]);

        $response->throw();
    }
}
