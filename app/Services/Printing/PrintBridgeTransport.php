<?php

namespace App\Services\Printing;

/**
 * Injectable boundary for the HTTP client used to reach the network
 * print-bridge service, keeping PrintBridgePrinterDriver testable without
 * any real network I/O or physical printer hardware.
 */
interface PrintBridgeTransport
{
    /**
     * Send the given print job's rendered image contents to the print
     * bridge endpoint. Implementations must throw on connection, timeout,
     * or HTTP failure so callers can surface a catchable error.
     *
     * @param  array<string, mixed>  $payload
     */
    public function send(
        string $endpoint,
        int $timeoutSeconds,
        ?string $authToken,
        string $imageContents,
        string $imageFilename,
        array $payload,
    ): void;
}
