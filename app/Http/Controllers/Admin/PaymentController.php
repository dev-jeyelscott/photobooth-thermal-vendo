<?php

namespace App\Http\Controllers\Admin;

use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PaymentController extends Controller
{
    /**
     * List payments with their session reference for read-only operational visibility.
     */
    public function index(Request $request): Response
    {
        $status = $request->string('status')->toString();
        $from = $request->string('from')->toString();
        $to = $request->string('to')->toString();

        $payments = Payment::query()
            ->with('photoboothSession')
            ->when($status !== '' && PaymentStatus::tryFrom($status) !== null, fn ($query) => $query->where('status', $status))
            ->when($from !== '', fn ($query) => $query->whereDate('created_at', '>=', $from))
            ->when($to !== '', fn ($query) => $query->whereDate('created_at', '<=', $to))
            ->orderByDesc('created_at')
            ->paginate(20)
            ->withQueryString();

        $payments->through(fn (Payment $payment) => $this->presentPayment($payment));

        return Inertia::render('admin/payments/index', [
            'payments' => $payments,
            'filters' => [
                'status' => $status !== '' ? $status : null,
                'from' => $from !== '' ? $from : null,
                'to' => $to !== '' ? $to : null,
            ],
            'statuses' => array_map(fn (PaymentStatus $case) => $case->value, PaymentStatus::cases()),
        ]);
    }

    /**
     * Present a payment for the frontend, excluding any sensitive credentials.
     *
     * @return array<string, mixed>
     */
    private function presentPayment(Payment $payment): array
    {
        return [
            'id' => $payment->id,
            'sessionToken' => $payment->photoboothSession?->session_token,
            'method' => $payment->method->value,
            'status' => $payment->status->value,
            'mayaPaymentId' => $payment->maya_payment_id,
            'mayaCheckoutId' => $payment->maya_checkout_id,
            'amount' => $payment->amount,
            'createdAt' => $payment->created_at?->toIso8601String(),
            'updatedAt' => $payment->updated_at?->toIso8601String(),
        ];
    }
}
