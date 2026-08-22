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

        $year = $request->integer('year', Carbon::now()->year);
        $month = $request->integer('month', Carbon::now()->month);

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
     * Compute the sales report metrics for an arbitrary date range.
     *
     * @param  array{0: Carbon, 1: Carbon}  $range
     * @return array{revenue: string, successfulPayments: int, failedPayments: int, completedSessions: int, voucherSessions: int, failedPrintJobs: int}
     */
    private function rangeStats(array $range): array
    {
        [$start, $end] = $range;

        $successfulPaymentsQuery = fn () => Payment::query()
            ->where('status', PaymentStatus::Success)
            ->whereHas('photoboothSession', function ($query) use ($start, $end) {
                $query->where('status', PhotoboothSessionStatus::Completed)
                    ->whereBetween('updated_at', [$start, $end]);
            });

        $revenue = (float) $successfulPaymentsQuery()->sum('amount');
        $successfulPayments = $successfulPaymentsQuery()->count();

        $failedPayments = Payment::query()
            ->where('status', PaymentStatus::Failed)
            ->whereBetween('updated_at', [$start, $end])
            ->count();

        $completedSessions = PhotoboothSession::query()
            ->where('status', PhotoboothSessionStatus::Completed)
            ->whereBetween('updated_at', [$start, $end])
            ->count();

        $voucherSessions = PhotoboothSession::query()
            ->where('status', PhotoboothSessionStatus::Completed)
            ->where('payment_method', PaymentMethod::Voucher)
            ->whereBetween('updated_at', [$start, $end])
            ->count();

        $failedPrintJobs = PrintJob::query()
            ->where('status', PrintJobStatus::Failed)
            ->whereHas('photoboothSession', function ($query) use ($start, $end) {
                $query->whereBetween('updated_at', [$start, $end]);
            })
            ->count();

        return [
            'revenue' => number_format($revenue, 2, '.', ''),
            'successfulPayments' => $successfulPayments,
            'failedPayments' => $failedPayments,
            'completedSessions' => $completedSessions,
            'voucherSessions' => $voucherSessions,
            'failedPrintJobs' => $failedPrintJobs,
        ];
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
