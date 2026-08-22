<?php

namespace App\Http\Controllers\Admin;

use App\Enums\PaymentStatus;
use App\Enums\PhotoboothSessionStatus;
use App\Enums\PrintJobStatus;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\PhotoboothSession;
use App\Models\PrintJob;
use App\Models\Voucher;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * The maximum number of items to include per activity type in the recent-activity feed.
     */
    private const int RECENT_ACTIVITY_LIMIT = 5;

    /**
     * Show the admin dashboard with a basic operational sales summary.
     */
    public function index(): Response
    {
        $today = [Carbon::now()->startOfDay(), Carbon::now()->endOfDay()];
        $month = [Carbon::now()->startOfMonth(), Carbon::now()->endOfMonth()];

        return Inertia::render('admin/dashboard', [
            'summary' => [
                'today' => $this->completedSessionStats($today),
                'thisMonth' => $this->completedSessionStats($month),
                'failedPayments' => Payment::query()->where('status', PaymentStatus::Failed)->count(),
                'failedPrintJobs' => PrintJob::query()->where('status', PrintJobStatus::Failed)->count(),
                'pendingPayments' => Payment::query()->where('status', PaymentStatus::Pending)->count(),
            ],
            'recentActivity' => $this->recentActivity(),
        ]);
    }

    /**
     * Get the count and sales total for sessions completed within the given date range.
     *
     * @param  array{0: Carbon, 1: Carbon}  $range
     * @return array{count: int, salesTotal: string}
     */
    private function completedSessionStats(array $range): array
    {
        $count = PhotoboothSession::query()
            ->where('status', PhotoboothSessionStatus::Completed)
            ->whereBetween('updated_at', $range)
            ->count();

        $salesTotal = Payment::query()
            ->where('status', PaymentStatus::Success)
            ->whereHas('photoboothSession', function ($query) use ($range) {
                $query->where('status', PhotoboothSessionStatus::Completed)
                    ->whereBetween('updated_at', $range);
            })
            ->sum('amount');

        return [
            'count' => $count,
            'salesTotal' => number_format((float) $salesTotal, 2, '.', ''),
        ];
    }

    /**
     * Build the recent-activity feed from the latest sessions, payments, voucher redemptions,
     * and failed print jobs, sorted by recency and capped to a bounded total size.
     *
     * @return array<int, array{
     *     type: string,
     *     label: string,
     *     occurredAt: string|null
     * }>
     */
    private function recentActivity(): array
    {
        $sessions = PhotoboothSession::query()
            ->latest('updated_at')
            ->limit(self::RECENT_ACTIVITY_LIMIT)
            ->get()
            ->map(fn (PhotoboothSession $session) => [
                'type' => 'session',
                'label' => "Session {$session->session_token} is {$session->status->value}",
                'occurredAt' => $session->updated_at,
            ]);

        $payments = Payment::query()
            ->latest('updated_at')
            ->limit(self::RECENT_ACTIVITY_LIMIT)
            ->get()
            ->map(fn (Payment $payment) => [
                'type' => 'payment',
                'label' => "Payment of ₱{$payment->amount} is {$payment->status->value}",
                'occurredAt' => $payment->updated_at,
            ]);

        $voucherRedemptions = Voucher::query()
            ->where('usage_count', '>', 0)
            ->latest('updated_at')
            ->limit(self::RECENT_ACTIVITY_LIMIT)
            ->get()
            ->map(fn (Voucher $voucher) => [
                'type' => 'voucher',
                'label' => "Voucher {$voucher->code} redeemed ({$voucher->usage_count}/{$voucher->usage_limit})",
                'occurredAt' => $voucher->updated_at,
            ]);

        $printFailures = PrintJob::query()
            ->where('status', PrintJobStatus::Failed)
            ->latest('updated_at')
            ->limit(self::RECENT_ACTIVITY_LIMIT)
            ->get()
            ->map(fn (PrintJob $printJob) => [
                'type' => 'print_failure',
                'label' => "Print job for session #{$printJob->photobooth_session_id} failed",
                'occurredAt' => $printJob->updated_at,
            ]);

        return $sessions
            ->concat($payments)
            ->concat($voucherRedemptions)
            ->concat($printFailures)
            ->sortByDesc('occurredAt')
            ->take(self::RECENT_ACTIVITY_LIMIT)
            ->map(fn (array $entry) => [
                'type' => $entry['type'],
                'label' => $entry['label'],
                'occurredAt' => $entry['occurredAt']?->toIso8601String(),
            ])
            ->values()
            ->all();
    }
}
