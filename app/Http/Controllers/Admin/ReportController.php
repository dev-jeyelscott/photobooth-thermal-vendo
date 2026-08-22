<?php

namespace App\Http\Controllers\Admin;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PhotoboothSessionStatus;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\PhotoboothSession;
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
