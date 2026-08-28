<?php

namespace App\Jobs;

use App\Actions\Payments\ProcessPayMongoWebhookEvent as ProcessPayMongoWebhookEventAction;
use App\Models\PayMongoWebhookEvent;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

class ProcessPayMongoWebhookEvent implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 5;

    /**
     * Create a queue-safe job containing only the durable local webhook event ID.
     */
    public function __construct(
        public readonly int $paymongoWebhookEventId,
    ) {}

    /**
     * Process the durable webhook inbox record idempotently.
     */
    public function handle(
        ProcessPayMongoWebhookEventAction $processor,
    ): void {
        $event = PayMongoWebhookEvent::query()
            ->findOrFail($this->paymongoWebhookEventId);

        try {
            $processor->handle($event);
        } catch (Throwable $exception) {
            $event->forceFill([
                'failed_at' => now(),
                'last_error' => class_basename($exception),
            ])->save();

            Log::error('PayMongo webhook event processing failed.', [
                'paymongo_webhook_event_id' => $event->id,
                'paymongo_account_id' => $event->paymongo_account_id,
                'provider_event_id' => $event->provider_event_id,
                'event_type' => $event->event_type,
                'exception' => class_basename($exception),
            ]);

            throw $exception;
        }
    }

    /**
     * Provide bounded retry delays for transient queue or database failures.
     *
     * @return list<int>
     */
    public function backoff(): array
    {
        return [5, 15, 30, 60];
    }
}
