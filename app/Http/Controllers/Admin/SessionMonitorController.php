<?php

namespace App\Http\Controllers\Admin;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PhotoboothSessionStatus;
use App\Enums\PrintJobStatus;
use App\Http\Controllers\Controller;
use App\Models\PhotoboothSession;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SessionMonitorController extends Controller
{
    /**
     * List photobooth sessions with payment, template, and print evidence for operational monitoring.
     */
    public function index(Request $request): Response
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $search = $request->string('search')->trim()->toString();
        $status = $request->string('status')->toString();
        $from = $request->string('from')->toString();
        $to = $request->string('to')->toString();
        $paymentStatus = $request->string('payment_status')->toString();
        $paymentMethod = $request->string('payment_method')->toString();
        $authorizationType = $request->string('authorization_type')->toString();
        $printStatus = $request->string('print_status')->toString();

        $sessions = PhotoboothSession::query()
            ->with(['payment', 'printJob', 'photoTemplate', 'stickerDesign', 'voucher'])
            ->when($search !== '', fn ($query) => $query->where('session_token', 'like', "%{$search}%"))
            ->when($status !== '' && PhotoboothSessionStatus::tryFrom($status) !== null, fn ($query) => $query->where('status', $status))
            ->when($from !== '', fn ($query) => $query->whereDate('started_at', '>=', $from))
            ->when($to !== '', fn ($query) => $query->whereDate('started_at', '<=', $to))
            ->when(
                $paymentStatus !== '' && PaymentStatus::tryFrom($paymentStatus) !== null,
                fn ($query) => $query->whereHas('payment', fn ($paymentQuery) => $paymentQuery->where('status', $paymentStatus))
            )
            ->when(
                $paymentMethod !== '' && PaymentMethod::tryFrom($paymentMethod) !== null,
                fn ($query) => $query->whereHas('payment', fn ($paymentQuery) => $paymentQuery->where('method', $paymentMethod))
            )
            ->when($authorizationType === 'voucher', fn ($query) => $query->whereNotNull('voucher_id'))
            ->when($authorizationType === 'payment', fn ($query) => $query->whereHas('payment'))
            ->when(
                $printStatus !== '' && PrintJobStatus::tryFrom($printStatus) !== null,
                fn ($query) => $query->whereHas('printJob', fn ($printJobQuery) => $printJobQuery->where('status', $printStatus))
            )
            ->orderByDesc('started_at')
            ->paginate(20)
            ->withQueryString();

        $sessions->through(fn (PhotoboothSession $session) => $this->presentSession($session));

        return Inertia::render('admin/sessions/index', [
            'sessions' => $sessions,
            'summary' => $this->summary(),
            'filters' => [
                'search' => $search !== '' ? $search : null,
                'status' => $status !== '' ? $status : null,
                'from' => $from !== '' ? $from : null,
                'to' => $to !== '' ? $to : null,
                'payment_status' => $paymentStatus !== '' ? $paymentStatus : null,
                'payment_method' => $paymentMethod !== '' ? $paymentMethod : null,
                'authorization_type' => $authorizationType !== '' ? $authorizationType : null,
                'print_status' => $printStatus !== '' ? $printStatus : null,
            ],
            'statuses' => array_map(fn (PhotoboothSessionStatus $case) => $case->value, PhotoboothSessionStatus::cases()),
            'paymentStatuses' => array_map(fn (PaymentStatus $case) => $case->value, PaymentStatus::cases()),
            'paymentMethods' => array_map(fn (PaymentMethod $case) => $case->value, PaymentMethod::cases()),
            'printStatuses' => array_map(fn (PrintJobStatus $case) => $case->value, PrintJobStatus::cases()),
        ]);
    }

    /**
     * Build all-time session aggregates independently of pagination and list filters.
     *
     * @return array{total: int, completed: int, inProgress: int, expiredOrAbandoned: int}
     */
    private function summary(): array
    {
        $counts = PhotoboothSession::query()
            ->selectRaw('status, count(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        $countFor = static fn (PhotoboothSessionStatus $status): int => (int) $counts->get($status->value, 0);

        $inProgress = array_sum(array_map($countFor, [
            PhotoboothSessionStatus::New,
            PhotoboothSessionStatus::PaymentPending,
            PhotoboothSessionStatus::Paid,
            PhotoboothSessionStatus::TemplateSelected,
            PhotoboothSessionStatus::Capturing,
            PhotoboothSessionStatus::Customizing,
            PhotoboothSessionStatus::Processing,
            PhotoboothSessionStatus::Printing,
        ]));

        return [
            'total' => (int) $counts->sum(),
            'completed' => $countFor(PhotoboothSessionStatus::Completed),
            'inProgress' => $inProgress,
            'expiredOrAbandoned' => $countFor(PhotoboothSessionStatus::Expired) + $countFor(PhotoboothSessionStatus::Abandoned),
        ];
    }

    /**
     * Present one session for the frontend without exposing private or mutable internals.
     *
     * @return array<string, mixed>
     */
    private function presentSession(PhotoboothSession $session): array
    {
        return [
            'id' => $session->id,
            'sessionToken' => $session->session_token,
            'status' => $session->status->value,
            'startedAt' => $session->started_at?->toIso8601String(),
            'expiresAt' => $session->expires_at?->toIso8601String(),
            'templateName' => $session->template_snapshot['name'] ?? $session->photoTemplate?->name,
            'voucherCode' => $session->voucher?->code,
            'price' => $session->price,
            'currency' => $session->currency,
            'paymentMethod' => $session->payment_method?->value,
            'payment' => $session->payment ? [
                'method' => $session->payment->method->value,
                'status' => $session->payment->status->value,
                'amount' => $session->payment->amount,
            ] : null,
            'printJob' => $session->printJob ? [
                'status' => $session->printJob->status->value,
                'attemptCount' => $session->printJob->attempt_count,
                'completedAt' => $session->printJob->completed_at?->toIso8601String(),
            ] : null,
        ];
    }
}
