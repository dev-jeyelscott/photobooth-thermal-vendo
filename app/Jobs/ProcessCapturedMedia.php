<?php

namespace App\Jobs;

use App\Actions\Processing\ComposeColorPhoto;
use App\Models\PhotoboothSession;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Composes a confirmed session's captured photos into the final color, B&W,
 * and GIF outputs off the customer-facing request thread. Safe to retry:
 * ComposeColorPhoto's updateOrCreate-on-session guard for captured_media and
 * its "create PrintJob only if none exists" guard prevent duplicates.
 */
class ProcessCapturedMedia implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * @param  list<string>  $photos  Raw image sources (data URIs, base64, or binary), in shot order, each base64-encoded so the payload survives queue serialization intact.
     */
    public function __construct(
        public readonly PhotoboothSession $session,
        public readonly array $photos,
    ) {}

    public function handle(ComposeColorPhoto $composeColorPhoto): void
    {
        try {
            $photos = array_map(base64_decode(...), $this->photos);

            $composeColorPhoto->handle($this->session, $photos);
        } catch (Throwable $exception) {
            Log::error('Photo processing failed.', [
                'session_token' => $this->session->session_token,
                'error' => $exception->getMessage(),
            ]);

            throw $exception;
        }
    }
}
