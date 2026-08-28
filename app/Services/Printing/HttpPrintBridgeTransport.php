<?php

namespace App\Services\Printing;

use Illuminate\Support\Facades\Http;

/**
 * Production PrintBridgeTransport implementation that forwards the receipt
 * image to the print bridge over HTTP using Laravel's HTTP client.
 */
class HttpPrintBridgeTransport implements PrintBridgeTransport
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function send(
        string $endpoint,
        int $timeoutSeconds,
        ?string $authToken,
        string $imageContents,
        string $imageFilename,
        array $payload,
    ): void {
        $request = Http::timeout($timeoutSeconds);

        if (! empty($authToken)) {
            $request = $request->withToken($authToken);
        }

        $response = $request
            ->attach('image', $imageContents, $imageFilename)
            ->post($endpoint, $payload);

        $response->throw();
    }
}
