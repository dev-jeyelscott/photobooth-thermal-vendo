<?php

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PhotoboothSessionStatus;
use App\Enums\PrintJobStatus;
use App\Models\Payment;
use App\Models\PhotoboothSession;
use App\Models\PrintJob;
use App\Models\User;
use App\Models\Voucher;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;

test('guests are redirected to the login page', function () {
    $response = $this->get(route('admin.dashboard'));

    $response->assertRedirect(route('login'));
});

test('authenticated users can visit the dashboard', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('admin.dashboard'))
        ->assertOk()
        ->assertInertia(
            fn (Assert $page) => $page->component('admin/dashboard'),
        );
});

test('dashboard exposes operator focused sales session and issue aggregates', function () {
    $this->travelTo(Carbon::parse('2026-08-23 12:00:00'));

    $user = User::factory()->create();

    $todayMayaSession = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Completed,
        'payment_method' => PaymentMethod::Maya,
        'started_at' => now()->subHour(),
        'created_at' => now()->subHour(),
        'updated_at' => now()->subHour(),
    ]);

    Payment::factory()->success()->create([
        'photobooth_session_id' => $todayMayaSession->id,
        'method' => PaymentMethod::Maya,
        'amount' => '100.00',
        'created_at' => now()->subHour(),
        'updated_at' => now()->subHour(),
    ]);

    $voucher = Voucher::factory()->create([
        'code' => 'THERMA-DEMO-1',
        'usage_limit' => 2,
        'usage_count' => 1,
        'created_at' => now()->subMinutes(45),
        'updated_at' => now()->subMinutes(45),
    ]);

    PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Completed,
        'payment_method' => PaymentMethod::Voucher,
        'voucher_id' => $voucher->id,
        'started_at' => now()->subMinutes(40),
        'created_at' => now()->subMinutes(40),
        'updated_at' => now()->subMinutes(40),
    ]);

    $monthlySession = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Completed,
        'payment_method' => PaymentMethod::Maya,
        'started_at' => now()->subDays(5),
        'created_at' => now()->subDays(5),
        'updated_at' => now()->subDays(5),
    ]);

    Payment::factory()->success()->create([
        'photobooth_session_id' => $monthlySession->id,
        'method' => PaymentMethod::Maya,
        'amount' => '50.00',
        'created_at' => now()->subDays(5),
        'updated_at' => now()->subDays(5),
    ]);

    Payment::factory()->create([
        'status' => PaymentStatus::Failed,
        'amount' => '20.00',
        'created_at' => now()->subMinutes(15),
        'updated_at' => now()->subMinutes(15),
    ]);

    Payment::factory()->create([
        'status' => PaymentStatus::Pending,
        'amount' => '20.00',
        'created_at' => now()->subMinutes(10),
        'updated_at' => now()->subMinutes(10),
    ]);

    PrintJob::factory()->create([
        'status' => PrintJobStatus::Pending,
        'created_at' => now()->subMinutes(8),
        'updated_at' => now()->subMinutes(8),
    ]);

    PrintJob::factory()->failed()->create([
        'created_at' => now()->subMinutes(2),
        'updated_at' => now()->subMinutes(2),
    ]);

    $this->actingAs($user)
        ->get(route('admin.dashboard'))
        ->assertOk()
        ->assertInertia(
            fn (Assert $page) => $page
                ->component('admin/dashboard')
                ->where('currency', 'PHP')
                ->where('summary.today.count', 2)
                ->where('summary.today.salesTotal', '100.00')
                ->where('summary.thisMonth.count', 3)
                ->where('summary.thisMonth.salesTotal', '150.00')
                ->where('summary.needsAttention.failedPayments', 1)
                ->where('summary.needsAttention.pendingPayments', 1)
                ->where('summary.needsAttention.failedPrintJobs', 1)
                ->where('summary.needsAttention.total', 3)
                ->has('trend', 7)
                ->where('trend.6.sales', 100)
                ->where('trend.6.sessions', 2)
                ->where('paymentMethods.total', 2)
                ->where('paymentMethods.maya', 1)
                ->where('paymentMethods.voucher', 1)
                ->where('operations.maintenanceMode', false)
                ->where('operations.pendingPrintJobs', 1)
                ->where('operations.printingJobs', 0)
                ->where('operations.failedPrintJobs', 1)
                ->where('operations.galleryExpirationHours', 168)
                ->has('recentActivity', 5)
                ->where('recentActivity.0.type', 'print_failure')
                ->where('recentActivity.0.title', 'Print job failed'),
        );
});
