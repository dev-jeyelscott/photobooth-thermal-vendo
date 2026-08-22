<?php

use App\Enums\PaymentStatus;
use App\Enums\PhotoboothSessionStatus;
use App\Models\Payment;
use App\Models\PhotoboothSession;
use App\Models\PrintJob;
use App\Models\User;
use App\Models\Voucher;

test('dashboard requires authentication', function () {
    $this->get(route('admin.dashboard'))->assertRedirect(route('login'));
});

test('dashboard shows sales summary computed from real session, payment, and print job data', function () {
    $user = User::factory()->create();

    $completedToday = PhotoboothSession::factory()
        ->create(['status' => PhotoboothSessionStatus::Completed, 'updated_at' => now()]);
    Payment::factory()->for($completedToday, 'photoboothSession')->success()->create(['amount' => '100.00']);

    $completedTodayNoPayment = PhotoboothSession::factory()
        ->create(['status' => PhotoboothSessionStatus::Completed, 'updated_at' => now()]);

    $completedEarlierThisMonth = PhotoboothSession::factory()
        ->create(['status' => PhotoboothSessionStatus::Completed, 'updated_at' => now()->startOfMonth()]);
    Payment::factory()->for($completedEarlierThisMonth, 'photoboothSession')->success()->create(['amount' => '50.00']);

    $completedLastMonth = PhotoboothSession::factory()
        ->create(['status' => PhotoboothSessionStatus::Completed, 'updated_at' => now()->subMonthNoOverflow()->startOfMonth()]);
    Payment::factory()->for($completedLastMonth, 'photoboothSession')->success()->create(['amount' => '999.00']);

    Payment::factory()->for(PhotoboothSession::factory(), 'photoboothSession')->create(['status' => PaymentStatus::Failed]);
    Payment::factory()->for(PhotoboothSession::factory(), 'photoboothSession')->create(['status' => PaymentStatus::Failed]);

    PrintJob::factory()->for(PhotoboothSession::factory(), 'photoboothSession')->failed()->create();

    Payment::factory()->for(PhotoboothSession::factory(), 'photoboothSession')->create(['status' => PaymentStatus::Pending]);
    Voucher::factory()->create(['usage_count' => 1, 'usage_limit' => 5]);

    $response = $this->actingAs($user)->get(route('admin.dashboard'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/dashboard')
        ->where('summary.today.count', 2)
        ->where('summary.today.salesTotal', '100.00')
        ->where('summary.thisMonth.count', 3)
        ->where('summary.thisMonth.salesTotal', '150.00')
        ->where('summary.failedPayments', 2)
        ->where('summary.failedPrintJobs', 1)
        ->where('summary.pendingPayments', 1)
        ->has('recentActivity')
        ->where('recentActivity', fn ($activity) => count($activity) > 0)
    );
});
