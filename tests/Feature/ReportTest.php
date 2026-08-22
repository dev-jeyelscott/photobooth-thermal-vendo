<?php

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PhotoboothSessionStatus;
use App\Models\Payment;
use App\Models\PhotoboothSession;
use App\Models\PrintJob;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

test('the daily report requires authentication', function () {
    $this->get(route('admin.reports.daily'))->assertRedirect(route('login'));
});

test('admin can view the daily sales report for a seeded day', function () {
    $user = User::factory()->create();
    $day = now()->subDay();

    $mayaSession = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Completed,
        'payment_method' => PaymentMethod::Maya,
        'updated_at' => $day->copy()->setTime(10, 0),
    ]);
    Payment::factory()->for($mayaSession, 'photoboothSession')->success()->create([
        'amount' => '150.00',
        'updated_at' => $day->copy()->setTime(10, 0),
    ]);

    $voucherSession = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Completed,
        'payment_method' => PaymentMethod::Voucher,
        'updated_at' => $day->copy()->setTime(11, 0),
    ]);
    Payment::factory()->for($voucherSession, 'photoboothSession')->success()->create([
        'amount' => '50.00',
        'method' => PaymentMethod::Voucher,
        'updated_at' => $day->copy()->setTime(11, 0),
    ]);

    Payment::factory()->create([
        'status' => PaymentStatus::Failed,
        'updated_at' => $day->copy()->setTime(12, 0),
    ]);

    // Outside the selected day; must not be included.
    $otherDaySession = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Completed,
        'payment_method' => PaymentMethod::Maya,
        'updated_at' => now()->subDays(5),
    ]);
    Payment::factory()->for($otherDaySession, 'photoboothSession')->success()->create([
        'amount' => '999.00',
        'updated_at' => now()->subDays(5),
    ]);

    $response = $this->actingAs($user)->get(route('admin.reports.daily', ['date' => $day->toDateString()]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/reports/daily')
        ->where('date', $day->toDateString())
        ->where('report.grossSales', '200.00')
        ->where('report.successfulSessions', 2)
        ->where('report.paidSessions', 1)
        ->where('report.voucherSessions', 1)
        ->where('report.failedPayments', 1)
        ->where('report.averageTransactionValue', '100.00')
    );
});

test('the daily report returns zeroed totals for a day with no activity', function () {
    $user = User::factory()->create();
    $day = now()->subDays(30);

    $response = $this->actingAs($user)->get(route('admin.reports.daily', ['date' => $day->toDateString()]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/reports/daily')
        ->where('report.grossSales', '0.00')
        ->where('report.successfulSessions', 0)
        ->where('report.paidSessions', 0)
        ->where('report.voucherSessions', 0)
        ->where('report.failedPayments', 0)
        ->where('report.averageTransactionValue', '0.00')
    );
});

test('an invalid date parameter is rejected', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route('admin.reports.daily', ['date' => 'not-a-date']));

    $response->assertSessionHasErrors('date');
});

test('the monthly report requires authentication', function () {
    $this->get(route('admin.reports.monthly'))->assertRedirect(route('login'));
});

test('admin can view the monthly sales report for a seeded month', function () {
    $user = User::factory()->create();
    $month = now()->subMonth()->startOfMonth();

    $mayaDayOne = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Completed,
        'payment_method' => PaymentMethod::Maya,
        'updated_at' => $month->copy()->addDays(2)->setTime(10, 0),
    ]);
    Payment::factory()->for($mayaDayOne, 'photoboothSession')->success()->create([
        'amount' => '150.00',
        'updated_at' => $month->copy()->addDays(2)->setTime(10, 0),
    ]);
    PrintJob::factory()->for($mayaDayOne, 'photoboothSession')->printed()->create();

    $voucher = Voucher::factory()->create();
    $voucherDayOne = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Completed,
        'payment_method' => PaymentMethod::Voucher,
        'voucher_id' => $voucher->id,
        'updated_at' => $month->copy()->addDays(2)->setTime(11, 0),
    ]);
    Payment::factory()->for($voucherDayOne, 'photoboothSession')->success()->create([
        'amount' => '50.00',
        'method' => PaymentMethod::Voucher,
        'updated_at' => $month->copy()->addDays(2)->setTime(11, 0),
    ]);
    PrintJob::factory()->for($voucherDayOne, 'photoboothSession')->failed()->create();

    $mayaDayTwo = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Completed,
        'payment_method' => PaymentMethod::Maya,
        'updated_at' => $month->copy()->addDays(10)->setTime(9, 0),
    ]);
    Payment::factory()->for($mayaDayTwo, 'photoboothSession')->success()->create([
        'amount' => '75.00',
        'updated_at' => $month->copy()->addDays(10)->setTime(9, 0),
    ]);

    // Outside the selected month; must not be included.
    $otherMonthSession = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Completed,
        'payment_method' => PaymentMethod::Maya,
        'updated_at' => now()->subMonths(3),
    ]);
    Payment::factory()->for($otherMonthSession, 'photoboothSession')->success()->create([
        'amount' => '999.00',
        'updated_at' => now()->subMonths(3),
    ]);

    $response = $this->actingAs($user)->get(route('admin.reports.monthly', [
        'year' => $month->year,
        'month' => $month->month,
    ]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/reports/monthly')
        ->where('year', $month->year)
        ->where('month', $month->month)
        ->where('report.grossSales', '275.00')
        ->where('report.successfulSessions', 3)
        ->where('report.paidSessions', 2)
        ->where('report.voucherSessions', 1)
        ->where('report.voucherRedemptions', 1)
        ->where('report.printedJobs', 1)
        ->where('report.failedPrintJobs', 1)
        ->where('report.dailyBreakdown', [
            [
                'date' => $month->copy()->addDays(2)->toDateString(),
                'grossSales' => '200.00',
                'successfulSessions' => 2,
            ],
            [
                'date' => $month->copy()->addDays(10)->toDateString(),
                'grossSales' => '75.00',
                'successfulSessions' => 1,
            ],
        ])
    );
});

test('the monthly report returns zeroed totals for a month with no activity', function () {
    $user = User::factory()->create();
    $month = now()->subYear();

    $response = $this->actingAs($user)->get(route('admin.reports.monthly', [
        'year' => $month->year,
        'month' => $month->month,
    ]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/reports/monthly')
        ->where('report.grossSales', '0.00')
        ->where('report.successfulSessions', 0)
        ->where('report.paidSessions', 0)
        ->where('report.voucherSessions', 0)
        ->where('report.voucherRedemptions', 0)
        ->where('report.printedJobs', 0)
        ->where('report.failedPrintJobs', 0)
        ->where('report.dailyBreakdown', [])
    );
});

test('an invalid month parameter is rejected', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route('admin.reports.monthly', ['month' => 13]));

    $response->assertSessionHasErrors('month');
});

test('the monthly report defaults to the current year and month using a single point in time', function () {
    $user = User::factory()->create();

    // Simulate the request occurring right at the January year boundary; the default
    // year and month must both come from the same instant, not drift between two calls.
    Carbon::setTestNow(Carbon::create(2026, 1, 1, 0, 0, 0));

    $response = $this->actingAs($user)->get(route('admin.reports.monthly'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/reports/monthly')
        ->where('year', 2026)
        ->where('month', 1)
    );

    Carbon::setTestNow();
});

test('the range report requires authentication', function () {
    $this->get(route('admin.reports.range', ['start' => '2026-01-01', 'end' => '2026-01-02']))
        ->assertRedirect(route('login'));
});

test('admin can view the date range report matching the sum of per-day daily reports', function () {
    $user = User::factory()->create();
    $dayOne = now()->subDays(3)->startOfDay();
    $dayTwo = now()->subDays(1)->startOfDay();

    $mayaSession = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Completed,
        'payment_method' => PaymentMethod::Maya,
        'updated_at' => $dayOne->copy()->setTime(10, 0),
    ]);
    Payment::factory()->for($mayaSession, 'photoboothSession')->success()->create([
        'amount' => '150.00',
        'updated_at' => $dayOne->copy()->setTime(10, 0),
    ]);

    $voucherSession = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Completed,
        'payment_method' => PaymentMethod::Voucher,
        'updated_at' => $dayTwo->copy()->setTime(11, 0),
    ]);
    Payment::factory()->for($voucherSession, 'photoboothSession')->success()->create([
        'amount' => '50.00',
        'method' => PaymentMethod::Voucher,
        'updated_at' => $dayTwo->copy()->setTime(11, 0),
    ]);

    Payment::factory()->create([
        'status' => PaymentStatus::Failed,
        'updated_at' => $dayTwo->copy()->setTime(12, 0),
    ]);

    PrintJob::factory()->for($voucherSession, 'photoboothSession')->failed()->create();

    // Outside the selected range; must not be included.
    $otherSession = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Completed,
        'payment_method' => PaymentMethod::Maya,
        'updated_at' => now()->subDays(30),
    ]);
    Payment::factory()->for($otherSession, 'photoboothSession')->success()->create([
        'amount' => '999.00',
        'updated_at' => now()->subDays(30),
    ]);

    // Per-day daily report totals for the same range, summed manually.
    $dailyOneReport = null;
    $this->actingAs($user)->get(route('admin.reports.daily', ['date' => $dayOne->toDateString()]))
        ->assertInertia(function ($page) use (&$dailyOneReport) {
            $dailyOneReport = $page->toArray()['props']['report'];

            return $page;
        });

    $dailyTwoReport = null;
    $this->actingAs($user)->get(route('admin.reports.daily', ['date' => $dayTwo->toDateString()]))
        ->assertInertia(function ($page) use (&$dailyTwoReport) {
            $dailyTwoReport = $page->toArray()['props']['report'];

            return $page;
        });

    $expectedRevenue = bcadd($dailyOneReport['grossSales'], $dailyTwoReport['grossSales'], 2);
    $expectedCompletedSessions = $dailyOneReport['successfulSessions'] + $dailyTwoReport['successfulSessions'];
    $expectedVoucherSessions = $dailyOneReport['voucherSessions'] + $dailyTwoReport['voucherSessions'];
    $expectedFailedPayments = $dailyOneReport['failedPayments'] + $dailyTwoReport['failedPayments'];

    $response = $this->actingAs($user)->get(route('admin.reports.range', [
        'start' => $dayOne->toDateString(),
        'end' => $dayTwo->toDateString(),
    ]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/reports/range')
        ->where('start', $dayOne->toDateString())
        ->where('end', $dayTwo->toDateString())
        ->where('report.revenue', $expectedRevenue)
        ->where('report.successfulPayments', 2)
        ->where('report.failedPayments', $expectedFailedPayments)
        ->where('report.completedSessions', $expectedCompletedSessions)
        ->where('report.voucherSessions', $expectedVoucherSessions)
        ->where('report.failedPrintJobs', 1)
    );
});

test('the range report returns zeroed totals for a range with no activity', function () {
    $user = User::factory()->create();
    $start = now()->subDays(60);
    $end = now()->subDays(58);

    $response = $this->actingAs($user)->get(route('admin.reports.range', [
        'start' => $start->toDateString(),
        'end' => $end->toDateString(),
    ]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/reports/range')
        ->where('report.revenue', '0.00')
        ->where('report.successfulPayments', 0)
        ->where('report.failedPayments', 0)
        ->where('report.completedSessions', 0)
        ->where('report.voucherSessions', 0)
        ->where('report.failedPrintJobs', 0)
    );
});

test('an inverted date range is rejected', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route('admin.reports.range', [
        'start' => now()->toDateString(),
        'end' => now()->subDay()->toDateString(),
    ]));

    $response->assertSessionHasErrors('end');
});

test('the report export requires authentication', function () {
    $this->get(route('admin.reports.export', ['start' => '2026-01-01', 'end' => '2026-01-02']))
        ->assertRedirect(route('login'));
});

test('admin can export the date range report as a streamed csv', function () {
    $user = User::factory()->create();
    $dayOne = now()->subDays(3)->startOfDay();
    $dayTwo = now()->subDays(1)->startOfDay();

    $voucher = Voucher::factory()->create(['code' => 'SAVE10']);

    $mayaSession = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Completed,
        'payment_method' => PaymentMethod::Maya,
        'started_at' => $dayOne->copy()->setTime(10, 0),
        'updated_at' => $dayOne->copy()->setTime(10, 0),
    ]);
    Payment::factory()->for($mayaSession, 'photoboothSession')->success()->create([
        'amount' => '150.00',
        'updated_at' => $dayOne->copy()->setTime(10, 0),
    ]);
    PrintJob::factory()->for($mayaSession, 'photoboothSession')->printed()->create();

    $voucherSession = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Completed,
        'payment_method' => PaymentMethod::Voucher,
        'voucher_id' => $voucher->id,
        'started_at' => $dayTwo->copy()->setTime(11, 0),
        'updated_at' => $dayTwo->copy()->setTime(11, 0),
    ]);
    Payment::factory()->for($voucherSession, 'photoboothSession')->success()->create([
        'amount' => '50.00',
        'method' => PaymentMethod::Voucher,
        'updated_at' => $dayTwo->copy()->setTime(11, 0),
    ]);

    // Outside the selected range; must not be included.
    PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Completed,
        'payment_method' => PaymentMethod::Maya,
        'updated_at' => now()->subDays(30),
    ]);

    $response = $this->actingAs($user)->get(route('admin.reports.export', [
        'start' => $dayOne->toDateString(),
        'end' => $dayTwo->toDateString(),
    ]));

    $response->assertOk();
    $response->assertHeader('content-type', 'text/csv; charset=UTF-8');
    $response->assertHeader('content-disposition');
    expect($response->headers->get('content-disposition'))->toContain('attachment');

    $rows = array_map('str_getcsv', explode("\n", trim($response->streamedContent())));
    $header = array_shift($rows);

    expect($header)->toBe([
        'session_token',
        'started_at',
        'payment_method',
        'payment_status',
        'amount',
        'voucher_code',
        'print_status',
    ]);

    expect($rows)->toHaveCount(2);

    $mayaRow = collect($rows)->first(fn ($row) => $row[0] === $mayaSession->session_token);

    expect($mayaRow)->toBe([
        $mayaSession->session_token,
        $mayaSession->started_at->toDateTimeString(),
        'maya',
        'success',
        '150.00',
        '',
        'printed',
    ]);

    $voucherRow = collect($rows)->first(fn ($row) => $row[0] === $voucherSession->session_token);

    expect($voucherRow)->toBe([
        $voucherSession->session_token,
        $voucherSession->started_at->toDateTimeString(),
        'voucher',
        'success',
        '50.00',
        'SAVE10',
        '',
    ]);
});

test('the report export eager loads relations without per-row lazy loading', function () {
    $user = User::factory()->create();
    $day = now()->subDays(2)->startOfDay();

    $sessions = collect(range(1, 5))->map(function (int $i) use ($day) {
        $session = PhotoboothSession::factory()->create([
            'status' => PhotoboothSessionStatus::Completed,
            'payment_method' => PaymentMethod::Maya,
            'started_at' => $day->copy()->setTime(8 + $i, 0),
            'updated_at' => $day->copy()->setTime(8 + $i, 0),
        ]);
        Payment::factory()->for($session, 'photoboothSession')->success()->create([
            'amount' => '100.00',
            'updated_at' => $day->copy()->setTime(8 + $i, 0),
        ]);
        PrintJob::factory()->for($session, 'photoboothSession')->printed()->create();

        return $session;
    });

    DB::enableQueryLog();

    $response = $this->actingAs($user)->get(route('admin.reports.export', [
        'start' => $day->toDateString(),
        'end' => $day->copy()->endOfDay()->toDateString(),
    ]));

    $rows = array_map('str_getcsv', explode("\n", trim($response->streamedContent())));
    array_shift($rows);

    $queryCount = count(DB::getQueryLog());
    DB::disableQueryLog();

    expect($rows)->toHaveCount($sessions->count());

    // Eager loading via lazy() keeps the query count independent of the exported row
    // count (one query per relation per batch), rather than growing per-session (N+1).
    expect($queryCount)->toBeLessThan($sessions->count() * 3);

    foreach ($sessions as $session) {
        $row = collect($rows)->first(fn ($row) => $row[0] === $session->session_token);

        expect($row[2])->toBe('maya')
            ->and($row[3])->toBe('success')
            ->and($row[4])->toBe('100.00')
            ->and($row[6])->toBe('printed');
    }
});

test('the report export rejects an inverted date range', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route('admin.reports.export', [
        'start' => now()->toDateString(),
        'end' => now()->subDay()->toDateString(),
    ]));

    $response->assertSessionHasErrors('end');
});
