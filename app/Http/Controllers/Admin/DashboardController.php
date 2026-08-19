<?php

namespace App\Http\Controllers\Admin;

use App\Enums\PaymentStatus;
use App\Enums\PhotoboothSessionStatus;
use App\Enums\PrintJobStatus;
use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\PhotoboothSession;
use App\Models\PrintJob;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Show the admin dashboard with a basic operational sales summary.
     */
    public function index(): Response
    {
        $today = [Carbon::now()->startOfDay(), Carbon::now()->endOfDay()];
        $month = [Carbon::now()->startOfMonth(), Carbon::now()->endOfMonth()];

        return Inertia::render('dashboard', [
            'summary' => [
                'today' => $this->completedSessionStats($today),
                'thisMonth' => $this->completedSessionStats($month),
                'failedPayments' => Payment::query()->where('status', PaymentStatus::Failed)->count(),
                'failedPrintJobs' => PrintJob::query()->where('status', PrintJobStatus::Failed)->count(),
            ],
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
}
