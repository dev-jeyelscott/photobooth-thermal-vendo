<?php

namespace App\Http\Controllers;

use App\Actions\Payments\ProcessMayaWebhook;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class MayaWebhookController extends Controller
{
    /**
     * Handle an incoming Maya payment webhook.
     */
    public function handle(Request $request, ProcessMayaWebhook $processMayaWebhook): JsonResponse
    {
        if (! $this->hasValidSignature($request)) {
            Log::warning('Maya webhook signature verification failed.', [
                'maya_checkout_id' => $request->input('checkoutId'),
                'maya_payment_id' => $request->input('id'),
            ]);

            return response()->json(['message' => 'Invalid webhook signature.'], 401);
        }

        $processed = $processMayaWebhook->handle($request->all());

        if (! $processed) {
            return response()->json(['message' => 'Unable to process webhook payload.'], 422);
        }

        return response()->json(['message' => 'Webhook processed.']);
    }

    /**
     * Verify the webhook payload was signed with the configured Maya webhook secret.
     */
    private function hasValidSignature(Request $request): bool
    {
        $secret = (string) config('services.maya.webhook_secret');
        $signature = (string) $request->header('Maya-Webhook-Signature');

        if ($secret === '' || $signature === '') {
            return false;
        }

        $expected = hash_hmac('sha256', $request->getContent(), $secret);

        return hash_equals($expected, $signature);
    }
}
