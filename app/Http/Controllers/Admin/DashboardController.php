<?php

namespace App\Http\Controllers\Admin;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PhotoboothSessionStatus;
use App\Enums\PrintJobStatus;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\PhotoboothSession;
use App\Models\PrintJob;
use App\Models\Voucher;
use App\Services\Settings;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * The number of recent activity items displayed on the dashboard.
     */
    private const int RECENT_ACTIVITY_LIMIT = 5;

    /**
     * The number of calendar days displayed by the dashboard trend chart.
     */
    private const int TREND_DAYS = 7;

    /**
     * Show the non-technical admin operational dashboard.
     */
    public function index(): Response
    {
        $today = [
            Carbon::now()->startOfDay(),
            Carbon::now()->endOfDay(),
        ];

        $month = [
            Carbon::now()->startOfMonth(),
            Carbon::now()->endOfMonth(),
        ];

        $printJobCounts = $this->printJobCounts();

        return Inertia::render('admin/dashboard', [
            'currency' => (string) Settings::get('currency'),
            'summary' => [
                'today' => $this->completedSessionStats($today),
                'thisMonth' => $this->completedSessionStats($month),
                'needsAttention' => $this->needsAttention(
                    $printJobCounts['failed'],
                ),
            ],
            'trend' => $this->trend(),
            'paymentMethods' => $this->paymentMethodBreakdown($today),
            'operations' => $this->operations($printJobCounts),
            'recentActivity' => $this->recentActivity(),
        ]);
    }

    /**
     * Get completed-session count and successful-payment sales for a date range.
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
                $query
                    ->where('status', PhotoboothSessionStatus::Completed)
                    ->whereBetween('updated_at', $range);
            })
            ->sum('amount');

        return [
            'count' => $count,
            'salesTotal' => number_format((float) $salesTotal, 2, '.', ''),
        ];
    }

    /**
     * Build the current failed and pending operational issue summary.
     *
     * @return array{
     *     failedPayments: int,
     *     pendingPayments: int,
     *     failedPrintJobs: int,
     *     total: int
     * }
     */
    private function needsAttention(int $failedPrintJobs): array
    {
        $paymentCounts = Payment::query()
            ->selectRaw('status, count(*) as aggregate')
            ->whereIn('status', [
                PaymentStatus::Pending->value,
                PaymentStatus::Failed->value,
            ])
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        $failedPayments = (int) (
            $paymentCounts[PaymentStatus::Failed->value] ?? 0
        );

        $pendingPayments = (int) (
            $paymentCounts[PaymentStatus::Pending->value] ?? 0
        );

        return [
            'failedPayments' => $failedPayments,
            'pendingPayments' => $pendingPayments,
            'failedPrintJobs' => $failedPrintJobs,
            'total' => $failedPayments + $pendingPayments + $failedPrintJobs,
        ];
    }

    /**
     * Build a seven-day trend of completed sessions and successful-payment sales.
     *
     * @return array<int, array{
     *     date: string,
     *     label: string,
     *     sales: float,
     *     sessions: int
     * }>
     */
    private function trend(): array
    {
        $end = Carbon::now()->endOfDay();
        $start = $end
            ->copy()
            ->subDays(self::TREND_DAYS - 1)
            ->startOfDay();

        $sessionsPerDay = PhotoboothSession::query()
            ->selectRaw('date(updated_at) as day')
            ->selectRaw('count(*) as aggregate')
            ->where('status', PhotoboothSessionStatus::Completed)
            ->whereBetween('updated_at', [$start, $end])
            ->groupBy('day')
            ->pluck('aggregate', 'day');

        $revenuePerDay = Payment::query()
            ->join(
                'photobooth_sessions',
                'photobooth_sessions.id',
                '=',
                'payments.photobooth_session_id',
            )
            ->selectRaw('date(photobooth_sessions.updated_at) as day')
            ->selectRaw('coalesce(sum(payments.amount), 0) as aggregate')
            ->where('payments.status', PaymentStatus::Success)
            ->where(
                'photobooth_sessions.status',
                PhotoboothSessionStatus::Completed,
            )
            ->whereBetween('photobooth_sessions.updated_at', [$start, $end])
            ->groupBy('day')
            ->pluck('aggregate', 'day');

        $trend = [];

        for (
            $cursor = $start->copy();
            $cursor->lte($end);
            $cursor->addDay()
        ) {
            $day = $cursor->toDateString();

            $trend[] = [
                'date' => $day,
                'label' => $cursor->format('M j'),
                'sales' => (float) ($revenuePerDay[$day] ?? 0),
                'sessions' => (int) ($sessionsPerDay[$day] ?? 0),
            ];
        }

        return $trend;
    }

    /**
     * Count today's completed sessions by their authorization/payment method.
     *
     * @param  array{0: Carbon, 1: Carbon}  $range
     * @return array{total: int, maya: int, voucher: int}
     */
    private function paymentMethodBreakdown(array $range): array
    {
        $baseQuery = PhotoboothSession::query()
            ->where('status', PhotoboothSessionStatus::Completed)
            ->whereBetween('updated_at', $range);

        $maya = (clone $baseQuery)
            ->where('payment_method', PaymentMethod::Maya)
            ->count();

        $voucher = (clone $baseQuery)
            ->where('payment_method', PaymentMethod::Voucher)
            ->count();

        return [
            'total' => $maya + $voucher,
            'maya' => $maya,
            'voucher' => $voucher,
        ];
    }

    /**
     * Count print jobs by durable status for dashboard operational reporting.
     *
     * @return array{
     *     pending: int,
     *     printing: int,
     *     printed: int,
     *     failed: int
     * }
     */
    private function printJobCounts(): array
    {
        $counts = PrintJob::query()
            ->selectRaw('status, count(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        return [
            'pending' => (int) (
                $counts[PrintJobStatus::Pending->value] ?? 0
            ),
            'printing' => (int) (
                $counts[PrintJobStatus::Printing->value] ?? 0
            ),
            'printed' => (int) (
                $counts[PrintJobStatus::Printed->value] ?? 0
            ),
            'failed' => (int) (
                $counts[PrintJobStatus::Failed->value] ?? 0
            ),
        ];
    }

    /**
     * Build truthful booth operational status from settings and durable print jobs.
     *
     * @param  array{
     *     pending: int,
     *     printing: int,
     *     printed: int,
     *     failed: int
     * }  $printJobCounts
     * @return array{
     *     maintenanceMode: bool,
     *     pendingPrintJobs: int,
     *     printingJobs: int,
     *     failedPrintJobs: int,
     *     galleryExpirationHours: int
     * }
     */
    private function operations(array $printJobCounts): array
    {
        return [
            'maintenanceMode' => (bool) Settings::get('maintenance_mode'),
            'pendingPrintJobs' => $printJobCounts['pending'],
            'printingJobs' => $printJobCounts['printing'],
            'failedPrintJobs' => $printJobCounts['failed'],
            'galleryExpirationHours' => (int) Settings::get(
                'gallery_expiration_hours',
            ),
        ];
    }

    /**
     * Build a bounded human-readable activity feed without exposing internal IDs.
     *
     * @return array<int, array{
     *     type: string,
     *     title: string,
     *     description: string,
     *     occurredAt: string|null
     * }>
     */
    private function recentActivity(): array
    {
        /**
         * @var array<int, array{
         *     type: string,
         *     title: string,
         *     description: string,
         *     occurredAt: string|null
         * }> $activity
         */
        $activity = [];

        $currency = (string) Settings::get('currency');

        $completedSessions = PhotoboothSession::query()
            ->with(['payment', 'voucher'])
            ->where('status', PhotoboothSessionStatus::Completed)
            ->latest('updated_at')
            ->limit(self::RECENT_ACTIVITY_LIMIT)
            ->get();

        foreach ($completedSessions as $session) {
            $description = match ($session->payment_method) {
                PaymentMethod::Maya => $session->payment !== null
                    ? "{$currency} {$session->payment->amount} via Maya"
                    : 'Completed via Maya',
                PaymentMethod::Voucher => $session->voucher !== null
                    ? "Voucher {$session->voucher->code}"
                    : 'Completed with voucher',
                default => 'Customer session finished successfully',
            };

            $activity[] = [
                'type' => 'session_completed',
                'title' => 'Session completed',
                'description' => $description,
                'occurredAt' => $session->updated_at?->toIso8601String(),
            ];
        }

        $payments = Payment::query()
            ->whereIn('status', [
                PaymentStatus::Success->value,
                PaymentStatus::Pending->value,
                PaymentStatus::Failed->value,
            ])
            ->latest('updated_at')
            ->limit(self::RECENT_ACTIVITY_LIMIT)
            ->get();

        foreach ($payments as $payment) {
            $title = match ($payment->status) {
                PaymentStatus::Success => 'Payment received',
                PaymentStatus::Pending => 'Payment pending',
                PaymentStatus::Failed => 'Payment failed',
                default => 'Payment updated',
            };

            $method = match ($payment->method) {
                PaymentMethod::Maya => 'Maya',
                PaymentMethod::Voucher => 'voucher',
            };

            $activity[] = [
                'type' => "payment_{$payment->status->value}",
                'title' => $title,
                'description' => "{$currency} {$payment->amount} via {$method}",
                'occurredAt' => $payment->updated_at?->toIso8601String(),
            ];
        }

        $vouchers = Voucher::query()
            ->where('usage_count', '>', 0)
            ->latest('updated_at')
            ->limit(self::RECENT_ACTIVITY_LIMIT)
            ->get();

        foreach ($vouchers as $voucher) {
            $activity[] = [
                'type' => 'voucher',
                'title' => 'Voucher redeemed',
                'description' => sprintf(
                    '%s, %d of %d uses',
                    $voucher->code,
                    $voucher->usage_count,
                    $voucher->usage_limit,
                ),
                'occurredAt' => $voucher->updated_at?->toIso8601String(),
            ];
        }

        $failedPrintJobs = PrintJob::query()
            ->where('status', PrintJobStatus::Failed)
            ->latest('updated_at')
            ->limit(self::RECENT_ACTIVITY_LIMIT)
            ->get();

        foreach ($failedPrintJobs as $printJob) {
            $activity[] = [
                'type' => 'print_failure',
                'title' => 'Print job failed',
                'description' => 'Printing needs operator review',
                'occurredAt' => $printJob->updated_at?->toIso8601String(),
            ];
        }

        usort(
            $activity,
            static fn (array $left, array $right): int => strcmp(
                $right['occurredAt'] ?? '',
                $left['occurredAt'] ?? '',
            ),
        );

        return array_slice($activity, 0, self::RECENT_ACTIVITY_LIMIT);
    }
}
