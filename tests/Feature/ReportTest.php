<?php

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PhotoboothSessionStatus;
use App\Models\Payment;
use App\Models\PhotoboothSession;
use App\Models\User;

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
