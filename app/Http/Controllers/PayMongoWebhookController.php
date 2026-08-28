<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessPayMongoWebhookEvent;
use App\Models\PayMongoAccount;
use App\Models\PayMongoWebhookEvent;
use App\Services\Payments\PayMongoWebhookSignatureVerifier;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use JsonException;
use Throwable;

class PayMongoWebhookController extends Controller
{
    /**
     * Verify, durably persist, and asynchronously acknowledge one PayMongo webhook.
     */
    public function __invoke(
        Request $request,
        PayMongoAccount $paymongoAccount,
        PayMongoWebhookSignatureVerifier $signatureVerifier,
    ): JsonResponse {
        $rawBody = $request->getContent();
        $signatureHeader = $request->header('Paymongo-Signature');

        if (
            ! $signatureVerifier->verify(
                $paymongoAccount,
                $rawBody,
                $signatureHeader,
            )
        ) {
            Log::warning('PayMongo webhook signature verification failed.', [
                'paymongo_account_public_id' => $paymongoAccount->public_id,
                'mode' => $paymongoAccount->mode->value,
            ]);

            return response()->json([
                'message' => 'Invalid webhook signature.',
            ], 401);
        }

        try {
            $payload = json_decode(
                $rawBody,
                true,
                512,
                JSON_THROW_ON_ERROR,
            );
        } catch (JsonException) {
            return response()->json([
                'message' => 'Malformed webhook payload.',
            ], 422);
        }

        if (! is_array($payload)) {
            return response()->json([
                'message' => 'Malformed webhook payload.',
            ], 422);
        }

        $providerEventId = data_get($payload, 'data.id');
        $resourceType = data_get($payload, 'data.type');
        $eventType = data_get($payload, 'data.attributes.type');
        $livemode = data_get($payload, 'data.attributes.livemode');

        if (
            ! is_string($providerEventId)
            || $providerEventId === ''
            || $resourceType !== 'event'
            || ! is_string($eventType)
            || $eventType === ''
            || ! is_bool($livemode)
        ) {
            return response()->json([
                'message' => 'Invalid webhook event envelope.',
            ], 422);
        }

        try {
            $event = PayMongoWebhookEvent::query()->create([
                'paymongo_account_id' => $paymongoAccount->id,
                'provider_event_id' => $providerEventId,
                'event_type' => $eventType,
                'livemode' => $livemode,
                'payload' => $payload,
                'payload_sha256' => hash('sha256', $rawBody),
                'received_at' => now(),
            ]);
        } catch (QueryException $exception) {
            $existingEvent = PayMongoWebhookEvent::query()
                ->where('provider_event_id', $providerEventId)
                ->first();

            if ($existingEvent === null) {
                throw $exception;
            }

            if (
                $existingEvent->paymongo_account_id
                !== $paymongoAccount->id
            ) {
                Log::warning(
                    'PayMongo provider event ID appeared under a different historical account.',
                    [
                        'provider_event_id' => $providerEventId,
                        'paymongo_account_public_id' => $paymongoAccount->public_id,
                    ],
                );

                return response()->json([
                    'message' => 'Webhook account mismatch.',
                ], 409);
            }

            /*
             * Requeue only an inbox record that never reached durable processing.
             * Financial mutation remains idempotent because the same event row
             * and locked Payment are processed again.
             */
            if ($existingEvent->processed_at === null) {
                ProcessPayMongoWebhookEvent::dispatch(
                    $existingEvent->id,
                );
            }

            return response()->json([
                'message' => 'Webhook already received.',
            ]);
        } catch (Throwable $exception) {
            Log::error('Unable to persist verified PayMongo webhook.', [
                'paymongo_account_public_id' => $paymongoAccount->public_id,
                'provider_event_id' => $providerEventId,
                'event_type' => $eventType,
                'exception' => class_basename($exception),
            ]);

            throw $exception;
        }

        ProcessPayMongoWebhookEvent::dispatch($event->id);

        return response()->json([
            'message' => 'Webhook accepted.',
        ]);
    }
}
