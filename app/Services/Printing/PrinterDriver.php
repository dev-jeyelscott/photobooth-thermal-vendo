<?php

namespace App\Services\Printing;

use App\Models\PrintJob;

/**
 * Printer-agnostic contract for dispatching a print job to a thermal printer.
 *
 * Concrete implementations may talk to a local mock, a network print bridge,
 * or any other hardware transport, keeping the app decoupled from a single
 * browser or device.
 */
interface PrinterDriver
{
    /**
     * Send the given print job's image to the printer.
     */
    public function send(PrintJob $job, string $imagePath): void;
}
