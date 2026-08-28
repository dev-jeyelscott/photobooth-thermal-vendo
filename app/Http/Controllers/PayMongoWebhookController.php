<?php

namespace App\Http\Controllers;

use App\Models\PayMongoAccount;
use Illuminate\Http\JsonResponse;

class PayMongoWebhookController extends Controller
{
    /**
     * Acknowledge the provisioned callback until signed processing lands in TH-PAY-005.
     */
    public function __invoke(
        PayMongoAccount $paymongoAccount,
    ): JsonResponse {
        abort_if($paymongoAccount->public_id === '', 404);

        return response()->json([
            'message' => 'Webhook endpoint ready.',
        ]);
    }
}
