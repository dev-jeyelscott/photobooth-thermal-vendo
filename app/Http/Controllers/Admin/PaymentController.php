<?php

namespace App\Http\Controllers\Admin;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PaymentController extends Controller
{
    /**
     * List immutable payment evidence with searchable provider and session references.
     */
    public function index(Request $request): Response
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:150'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $search = $request->string('search')->trim()->toString();
        $status = $request->string('status')->toString();
        $method = $request->string('method')->toString();
        $from = $request->string('from')->toString();
        $to = $request->string('to')->toString();

        $payments = Payment::query()
            ->with('photoboothSession')
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($searchQuery) use ($search) {
                    $searchQuery
                        ->where('maya_payment_id', 'like', "%{$search}%")
                        ->orWhere('maya_checkout_id', 'like', "%{$search}%")
                        ->orWhereHas('photoboothSession', fn ($sessionQuery) => $sessionQuery->where('session_token', 'like', "%{$search}%"));
                });
            })
            ->when($status !== '' && PaymentStatus::tryFrom($status) !== null, fn ($query) => $query->where('status', $status))
            ->when($method !== '' && PaymentMethod::tryFrom($method) !== null, fn ($query) => $query->where('method', $method))
            ->when($from !== '', fn ($query) => $query->whereDate('created_at', '>=', $from))
            ->when($to !== '', fn ($query) => $query->whereDate('created_at', '<=', $to))
            ->orderByDesc('created_at')
            ->paginate(20)
            ->withQueryString();

        $payments->through(fn (Payment $payment) => $this->presentPayment($payment));

        return Inertia::render('admin/payments/index', [
            'payments' => $payments,
            'summary' => $this->summary(),
            'filters' => [
                'search' => $search !== '' ? $search : null,
                'status' => $status !== '' ? $status : null,
                'method' => $method !== '' ? $method : null,
                'from' => $from !== '' ? $from : null,
                'to' => $to !== '' ? $to : null,
            ],
            'statuses' => array_map(fn (PaymentStatus $case) => $case->value, PaymentStatus::cases()),
            'methods' => array_map(fn (PaymentMethod $case) => $case->value, PaymentMethod::cases()),
        ]);
    }

    /**
     * Build all-time payment aggregates independently of pagination and list filters.
     *
     * @return array{total: int, successful: int, pending: int, failedOrCancelled: int}
     */
    private function summary(): array
    {
        $counts = Payment::query()
            ->selectRaw('status, count(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        $countFor = static fn (PaymentStatus $status): int => (int) $counts->get($status->value, 0);

        return [
            'total' => (int) $counts->sum(),
            'successful' => $countFor(PaymentStatus::Success),
            'pending' => $countFor(PaymentStatus::Pending),
            'failedOrCancelled' => $countFor(PaymentStatus::Failed) + $countFor(PaymentStatus::Cancelled),
        ];
    }

    /**
     * Present one immutable payment record without exposing any provider credentials.
     *
     * @return array<string, mixed>
     */
    private function presentPayment(Payment $payment): array
    {
        return [
            'id' => $payment->id,
            'sessionToken' => $payment->photoboothSession?->session_token,
            'currency' => $payment->photoboothSession?->currency,
            'method' => $payment->method->value,
            'status' => $payment->status->value,
            'mayaPaymentId' => $payment->maya_payment_id,
            'mayaCheckoutId' => $payment->maya_checkout_id,
            'amount' => $payment->amount,
            'paidAt' => $payment->paid_at?->toIso8601String(),
            'createdAt' => $payment->created_at?->toIso8601String(),
            'updatedAt' => $payment->updated_at?->toIso8601String(),
        ];
    }
}
