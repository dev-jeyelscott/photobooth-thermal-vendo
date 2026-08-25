<?php

namespace App\Http\Controllers\Admin;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PhotoboothSessionStatus;
use App\Enums\PrintJobStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\DateRangeReportRequest;
use App\Models\Payment;
use App\Models\PhotoboothSession;
use App\Models\PrintJob;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    /**
     * Show the daily sales report for a selectable day, defaulting to today.
     */
    public function daily(Request $request): Response
    {
        $request->validate([
            'date' => ['sometimes', 'date'],
        ]);

        $date = $request->filled('date')
            ? Carbon::parse($request->string('date')->toString())
            : Carbon::now();

        $range = [$date->copy()->startOfDay(), $date->copy()->endOfDay()];

        return Inertia::render('admin/reports/daily', [
            'date' => $date->toDateString(),
            'report' => $this->dailyStats($range),
        ]);
    }

    /**
     * Show the monthly sales report for a selectable month, defaulting to the current month.
     */
    public function monthly(Request $request): Response
    {
        $request->validate([
            'year' => ['sometimes', 'integer', 'min:2000', 'max:2100'],
            'month' => ['sometimes', 'integer', 'min:1', 'max:12'],
        ]);

        $now = Carbon::now();
        $year = $request->integer('year', $now->year);
        $month = $request->integer('month', $now->month);

        $start = Carbon::create($year, $month, 1)->startOfMonth();
        $end = $start->copy()->endOfMonth();

        return Inertia::render('admin/reports/monthly', [
            'year' => $year,
            'month' => $month,
            'report' => $this->monthlyStats([$start, $end]),
        ]);
    }

    /**
     * Show the sales report for an arbitrary admin-selected start/end date range.
     */
    public function range(DateRangeReportRequest $request): Response
    {
        $start = Carbon::parse($request->validated('start'))->startOfDay();
        $end = Carbon::parse($request->validated('end'))->endOfDay();

        return Inertia::render('admin/reports/range', [
            'start' => $start->toDateString(),
            'end' => $end->toDateString(),
            'report' => $this->rangeStats([$start, $end]),
        ]);
    }

    /**
     * Stream the underlying transactional data for an arbitrary date range as a CSV download.
     */
    public function export(DateRangeReportRequest $request): StreamedResponse
    {
        $start = Carbon::parse($request->validated('start'))->startOfDay();
        $end = Carbon::parse($request->validated('end'))->endOfDay();

        $filename = sprintf('sales-report_%s_%s.csv', $start->toDateString(), $end->toDateString());

        return response()->streamDownload(function () use ($start, $end) {
            $handle = fopen('php://output', 'w');

            if ($handle === false) {
                throw new RuntimeException('Unable to open the CSV output stream.');
            }

            fputcsv($handle, [
                'session_token',
                'started_at',
                'payment_method',
                'payment_status',
                'amount',
                'voucher_code',
                'print_status',
            ]);

            PhotoboothSession::query()
                ->with(['payment', 'voucher', 'printJob'])
                ->whereBetween('updated_at', [$start, $end])
                ->orderBy('updated_at')
                ->lazy()
                ->each(function (PhotoboothSession $session) use ($handle) {
                    fputcsv($handle, [
                        $session->session_token,
                        $session->started_at?->toDateTimeString(),
                        $session->payment_method?->value,
                        $session->payment?->status?->value,
                        $session->payment?->amount,
                        $session->voucher?->code,
                        $session->printJob?->status?->value,
                    ]);
                });

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    /**
     * Compute summary KPIs and the per-day breakdown for an arbitrary date range.
     *
     * @param  array{0: Carbon, 1: Carbon}  $range
     * @return array{
     *     revenue: string,
     *     successfulPayments: int,
     *     failedPayments: int,
     *     completedSessions: int,
     *     voucherSessions: int,
     *     failedPrintJobs: int,
     *     totalSessions: int,
     *     printedJobs: int,
     *     printSuccessRate: float|null,
     *     averageTicketSize: string,
     *     dailyBreakdown: array<int, array{
     *         date: string,
     *         totalSessions: int,
     *         completedSessions: int,
     *         completedRate: float,
     *         expiredOrAbandonedSessions: int,
     *         expiredOrAbandonedRate: float,
     *         revenue: string,
     *         successfulPayments: int,
     *         printedJobs: int,
     *         failedPrintJobs: int,
     *         printSuccessRate: float|null,
     *         averageTicketSize: string,
     *     }>,
     * }
     */
    private function rangeStats(array $range): array
    {
        [$start, $end] = $range;

        $sessionStats = PhotoboothSession::query()
            ->selectRaw('date(updated_at) as day')
            ->selectRaw('count(*) as total_sessions')
            ->selectRaw(
                'sum(case when status = ? then 1 else 0 end) as completed_sessions',
                [PhotoboothSessionStatus::Completed->value],
            )
            ->selectRaw(
                'sum(case when status in (?, ?) then 1 else 0 end) as expired_or_abandoned_sessions',
                [
                    PhotoboothSessionStatus::Expired->value,
                    PhotoboothSessionStatus::Abandoned->value,
                ],
            )
            ->selectRaw(
                'sum(case when status = ? and payment_method = ? then 1 else 0 end) as voucher_sessions',
                [
                    PhotoboothSessionStatus::Completed->value,
                    PaymentMethod::Voucher->value,
                ],
            )
            ->whereBetween('updated_at', [$start, $end])
            ->groupBy('day')
            ->get()
            ->keyBy(fn (PhotoboothSession $row) => (string) $row->getAttribute('day'));

        $paymentStats = Payment::query()
            ->join('photobooth_sessions', 'photobooth_sessions.id', '=', 'payments.photobooth_session_id')
            ->selectRaw('date(photobooth_sessions.updated_at) as day')
            ->selectRaw('coalesce(sum(payments.amount), 0) as revenue')
            ->selectRaw('count(*) as successful_payments')
            ->where('payments.status', PaymentStatus::Success)
            ->where('photobooth_sessions.status', PhotoboothSessionStatus::Completed)
            ->whereBetween('photobooth_sessions.updated_at', [$start, $end])
            ->groupBy('day')
            ->get()
            ->keyBy(fn (Payment $row) => (string) $row->getAttribute('day'));

        $printStats = PrintJob::query()
            ->join('photobooth_sessions', 'photobooth_sessions.id', '=', 'print_jobs.photobooth_session_id')
            ->selectRaw('date(photobooth_sessions.updated_at) as day')
            ->selectRaw(
                'sum(case when print_jobs.status = ? then 1 else 0 end) as printed_jobs',
                [PrintJobStatus::Printed->value],
            )
            ->selectRaw(
                'sum(case when print_jobs.status = ? then 1 else 0 end) as failed_print_jobs',
                [PrintJobStatus::Failed->value],
            )
            ->whereIn('print_jobs.status', [PrintJobStatus::Printed->value, PrintJobStatus::Failed->value])
            ->whereBetween('photobooth_sessions.updated_at', [$start, $end])
            ->groupBy('day')
            ->get()
            ->keyBy(fn (PrintJob $row) => (string) $row->getAttribute('day'));

        $days = $sessionStats->keys()
            ->merge($paymentStats->keys())
            ->merge($printStats->keys())
            ->unique()
            ->sort()
            ->values();

        $dailyBreakdown = $days->map(function (int|string $day) use ($sessionStats, $paymentStats, $printStats): array {
            $day = (string) $day;
            $sessionRow = $sessionStats->get($day);
            $paymentRow = $paymentStats->get($day);
            $printRow = $printStats->get($day);

            $totalSessions = (int) ($sessionRow?->getAttribute('total_sessions') ?? 0);
            $completedSessions = (int) ($sessionRow?->getAttribute('completed_sessions') ?? 0);
            $expiredOrAbandonedSessions = (int) ($sessionRow?->getAttribute('expired_or_abandoned_sessions') ?? 0);
            $revenue = (float) ($paymentRow?->getAttribute('revenue') ?? 0);
            $successfulPayments = (int) ($paymentRow?->getAttribute('successful_payments') ?? 0);
            $printedJobs = (int) ($printRow?->getAttribute('printed_jobs') ?? 0);
            $failedPrintJobs = (int) ($printRow?->getAttribute('failed_print_jobs') ?? 0);
            $terminalPrintJobs = $printedJobs + $failedPrintJobs;

            return [
                'date' => $day,
                'totalSessions' => $totalSessions,
                'completedSessions' => $completedSessions,
                'completedRate' => $this->calculatePercentage($completedSessions, $totalSessions),
                'expiredOrAbandonedSessions' => $expiredOrAbandonedSessions,
                'expiredOrAbandonedRate' => $this->calculatePercentage($expiredOrAbandonedSessions, $totalSessions),
                'revenue' => number_format($revenue, 2, '.', ''),
                'successfulPayments' => $successfulPayments,
                'printedJobs' => $printedJobs,
                'failedPrintJobs' => $failedPrintJobs,
                'printSuccessRate' => $terminalPrintJobs > 0
                    ? $this->calculatePercentage($printedJobs, $terminalPrintJobs)
                    : null,
                'averageTicketSize' => number_format(
                    $successfulPayments > 0 ? $revenue / $successfulPayments : 0,
                    2,
                    '.',
                    '',
                ),
            ];
        })->all();

        $totalSessions = (int) $sessionStats->sum(fn (PhotoboothSession $row) => (int) $row->getAttribute('total_sessions'));
        $completedSessions = (int) $sessionStats->sum(fn (PhotoboothSession $row) => (int) $row->getAttribute('completed_sessions'));
        $voucherSessions = (int) $sessionStats->sum(fn (PhotoboothSession $row) => (int) $row->getAttribute('voucher_sessions'));
        $revenue = (float) $paymentStats->sum(fn (Payment $row) => (float) $row->getAttribute('revenue'));
        $successfulPayments = (int) $paymentStats->sum(fn (Payment $row) => (int) $row->getAttribute('successful_payments'));
        $printedJobs = (int) $printStats->sum(fn (PrintJob $row) => (int) $row->getAttribute('printed_jobs'));
        $failedPrintJobs = (int) $printStats->sum(fn (PrintJob $row) => (int) $row->getAttribute('failed_print_jobs'));
        $terminalPrintJobs = $printedJobs + $failedPrintJobs;

        $failedPayments = Payment::query()
            ->where('status', PaymentStatus::Failed)
            ->whereBetween('updated_at', [$start, $end])
            ->count();

        return [
            'revenue' => number_format($revenue, 2, '.', ''),
            'successfulPayments' => $successfulPayments,
            'failedPayments' => $failedPayments,
            'completedSessions' => $completedSessions,
            'voucherSessions' => $voucherSessions,
            'failedPrintJobs' => $failedPrintJobs,
            'totalSessions' => $totalSessions,
            'printedJobs' => $printedJobs,
            'printSuccessRate' => $terminalPrintJobs > 0
                ? $this->calculatePercentage($printedJobs, $terminalPrintJobs)
                : null,
            'averageTicketSize' => number_format(
                $successfulPayments > 0 ? $revenue / $successfulPayments : 0,
                2,
                '.',
                '',
            ),
            'dailyBreakdown' => $dailyBreakdown,
        ];
    }

    /**
     * Calculate a one-decimal percentage while remaining safe for empty totals.
     */
    private function calculatePercentage(int $value, int $total): float
    {
        if ($total <= 0) {
            return 0.0;
        }

        return round(($value / $total) * 100, 1);
    }

    /**
     * Compute the monthly sales report metrics for the given date range.
     *
     * @param  array{0: Carbon, 1: Carbon}  $range
     * @return array{
     *     grossSales: string,
     *     successfulSessions: int,
     *     paidSessions: int,
     *     voucherSessions: int,
     *     voucherRedemptions: int,
     *     printedJobs: int,
     *     failedPrintJobs: int,
     *     dailyBreakdown: array<int, array{date: string, grossSales: string, successfulSessions: int}>,
     * }
     */
    private function monthlyStats(array $range): array
    {
        [$start, $end] = $range;

        $sessionsPerDay = PhotoboothSession::query()
            ->selectRaw('date(updated_at) as day')
            ->selectRaw('count(*) as sessions')
            ->where('status', PhotoboothSessionStatus::Completed)
            ->whereBetween('updated_at', [$start, $end])
            ->groupBy('day')
            ->pluck('sessions', 'day');

        $revenuePerDay = Payment::query()
            ->join('photobooth_sessions', 'photobooth_sessions.id', '=', 'payments.photobooth_session_id')
            ->selectRaw('date(photobooth_sessions.updated_at) as day')
            ->selectRaw('coalesce(sum(payments.amount), 0) as gross_sales')
            ->where('payments.status', PaymentStatus::Success)
            ->where('photobooth_sessions.status', PhotoboothSessionStatus::Completed)
            ->whereBetween('photobooth_sessions.updated_at', [$start, $end])
            ->groupBy('day')
            ->pluck('gross_sales', 'day');

        $dailyBreakdown = $sessionsPerDay->keys()
            ->merge($revenuePerDay->keys())
            ->unique()
            ->sort()
            ->values()
            ->map(fn ($day) => [
                'date' => (string) $day,
                'grossSales' => number_format((float) ($revenuePerDay[$day] ?? 0), 2, '.', ''),
                'successfulSessions' => (int) ($sessionsPerDay[$day] ?? 0),
            ])
            ->all();

        $successfulSessions = PhotoboothSession::query()
            ->where('status', PhotoboothSessionStatus::Completed)
            ->whereBetween('updated_at', [$start, $end])
            ->count();

        $grossSales = Payment::query()
            ->where('status', PaymentStatus::Success)
            ->whereHas('photoboothSession', function ($query) use ($start, $end) {
                $query->where('status', PhotoboothSessionStatus::Completed)
                    ->whereBetween('updated_at', [$start, $end]);
            })
            ->sum('amount');

        $paidSessions = PhotoboothSession::query()
            ->where('status', PhotoboothSessionStatus::Completed)
            ->where('payment_method', PaymentMethod::Maya)
            ->whereBetween('updated_at', [$start, $end])
            ->count();

        $voucherSessions = PhotoboothSession::query()
            ->where('status', PhotoboothSessionStatus::Completed)
            ->where('payment_method', PaymentMethod::Voucher)
            ->whereBetween('updated_at', [$start, $end])
            ->count();

        $voucherRedemptions = PhotoboothSession::query()
            ->whereNotNull('voucher_id')
            ->where('status', PhotoboothSessionStatus::Completed)
            ->whereBetween('updated_at', [$start, $end])
            ->count();

        $printedJobs = PrintJob::query()
            ->where('status', PrintJobStatus::Printed)
            ->whereHas('photoboothSession', function ($query) use ($start, $end) {
                $query->whereBetween('updated_at', [$start, $end]);
            })
            ->count();

        $failedPrintJobs = PrintJob::query()
            ->where('status', PrintJobStatus::Failed)
            ->whereHas('photoboothSession', function ($query) use ($start, $end) {
                $query->whereBetween('updated_at', [$start, $end]);
            })
            ->count();

        return [
            'grossSales' => number_format((float) $grossSales, 2, '.', ''),
            'successfulSessions' => $successfulSessions,
            'paidSessions' => $paidSessions,
            'voucherSessions' => $voucherSessions,
            'voucherRedemptions' => $voucherRedemptions,
            'printedJobs' => $printedJobs,
            'failedPrintJobs' => $failedPrintJobs,
            'dailyBreakdown' => $dailyBreakdown,
        ];
    }

    /**
     * Compute the daily sales report metrics for the given date range, following the same
     * aggregation pattern as DashboardController::completedSessionStats.
     *
     * @param  array{0: Carbon, 1: Carbon}  $range
     * @return array{grossSales: string, successfulSessions: int, paidSessions: int, voucherSessions: int, failedPayments: int, averageTransactionValue: string}
     */
    private function dailyStats(array $range): array
    {
        $successfulSessions = PhotoboothSession::query()
            ->where('status', PhotoboothSessionStatus::Completed)
            ->whereBetween('updated_at', $range)
            ->count();

        $grossSales = Payment::query()
            ->where('status', PaymentStatus::Success)
            ->whereHas('photoboothSession', function ($query) use ($range) {
                $query->where('status', PhotoboothSessionStatus::Completed)
                    ->whereBetween('updated_at', $range);
            })
            ->sum('amount');

        $paidSessions = PhotoboothSession::query()
            ->where('status', PhotoboothSessionStatus::Completed)
            ->where('payment_method', PaymentMethod::Maya)
            ->whereBetween('updated_at', $range)
            ->count();

        $voucherSessions = PhotoboothSession::query()
            ->where('status', PhotoboothSessionStatus::Completed)
            ->where('payment_method', PaymentMethod::Voucher)
            ->whereBetween('updated_at', $range)
            ->count();

        $failedPayments = Payment::query()
            ->where('status', PaymentStatus::Failed)
            ->whereBetween('updated_at', $range)
            ->count();

        $grossSales = (float) $grossSales;
        $averageTransactionValue = $successfulSessions > 0 ? $grossSales / $successfulSessions : 0.0;

        return [
            'grossSales' => number_format($grossSales, 2, '.', ''),
            'successfulSessions' => $successfulSessions,
            'paidSessions' => $paidSessions,
            'voucherSessions' => $voucherSessions,
            'failedPayments' => $failedPayments,
            'averageTransactionValue' => number_format($averageTransactionValue, 2, '.', ''),
        ];
    }
}
