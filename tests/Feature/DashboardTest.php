<?php

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PhotoboothSessionStatus;
use App\Enums\PrintJobStatus;
use App\Models\Payment;
use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use App\Models\PrintJob;
use App\Models\StickerDesign;
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

test('dashboard exposes reference ready operator aggregates from durable data', function () {
    $this->travelTo(Carbon::parse('2026-08-23 12:00:00'));

    $user = User::factory()->create();

    $activeTemplate = PhotoTemplate::factory()->create();
    PhotoTemplate::factory()->create();
    PhotoTemplate::factory()->inactive()->create();

    StickerDesign::factory()->count(2)->create();
    StickerDesign::factory()->inactive()->create();

    $redeemedVoucher = Voucher::factory()->create([
        'code' => 'THERMA-DEMO-1',
        'usage_limit' => 3,
        'usage_count' => 1,
        'created_at' => now()->subMinutes(45),
        'updated_at' => now()->subMinutes(45),
    ]);

    Voucher::factory()->create([
        'usage_limit' => 5,
        'usage_count' => 2,
        'created_at' => now()->subHours(2),
        'updated_at' => now()->subHours(2),
    ]);

    Voucher::factory()->expired()->create([
        'created_at' => now()->subHours(2),
        'updated_at' => now()->subHours(2),
    ]);

    Voucher::factory()->exhausted()->create([
        'created_at' => now()->subHours(2),
        'updated_at' => now()->subHours(2),
    ]);

    Voucher::factory()->inactive()->create([
        'created_at' => now()->subHours(2),
        'updated_at' => now()->subHours(2),
    ]);

    $todayMayaSession = PhotoboothSession::factory()->create([
        'photo_template_id' => $activeTemplate->id,
        'status' => PhotoboothSessionStatus::Completed,
        'payment_method' => PaymentMethod::Maya,
        'price' => '100.00',
        'currency' => 'PHP',
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

    $todayVoucherSession = PhotoboothSession::factory()->create([
        'photo_template_id' => $activeTemplate->id,
        'status' => PhotoboothSessionStatus::Completed,
        'payment_method' => PaymentMethod::Voucher,
        'voucher_id' => $redeemedVoucher->id,
        'price' => '100.00',
        'currency' => 'PHP',
        'started_at' => now()->subMinutes(40),
        'created_at' => now()->subMinutes(40),
        'updated_at' => now()->subMinutes(40),
    ]);

    $monthlySession = PhotoboothSession::factory()->create([
        'photo_template_id' => $activeTemplate->id,
        'status' => PhotoboothSessionStatus::Completed,
        'payment_method' => PaymentMethod::Maya,
        'price' => '50.00',
        'currency' => 'PHP',
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

    $yesterdaySession = PhotoboothSession::factory()->create([
        'photo_template_id' => $activeTemplate->id,
        'status' => PhotoboothSessionStatus::Completed,
        'payment_method' => PaymentMethod::Maya,
        'price' => '80.00',
        'currency' => 'PHP',
        'started_at' => now()->subDay()->subHour(),
        'created_at' => now()->subDay()->subHour(),
        'updated_at' => now()->subDay()->subHour(),
    ]);

    Payment::factory()->success()->create([
        'photobooth_session_id' => $yesterdaySession->id,
        'method' => PaymentMethod::Maya,
        'amount' => '80.00',
        'created_at' => now()->subDay()->subHour(),
        'updated_at' => now()->subDay()->subHour(),
    ]);

    $previousMonthSession = PhotoboothSession::factory()->create([
        'photo_template_id' => $activeTemplate->id,
        'status' => PhotoboothSessionStatus::Completed,
        'payment_method' => PaymentMethod::Maya,
        'price' => '120.00',
        'currency' => 'PHP',
        'started_at' => Carbon::parse('2026-07-10 10:00:00'),
        'created_at' => Carbon::parse('2026-07-10 10:00:00'),
        'updated_at' => Carbon::parse('2026-07-10 10:00:00'),
    ]);

    Payment::factory()->success()->create([
        'photobooth_session_id' => $previousMonthSession->id,
        'method' => PaymentMethod::Maya,
        'amount' => '120.00',
        'created_at' => Carbon::parse('2026-07-10 10:00:00'),
        'updated_at' => Carbon::parse('2026-07-10 10:00:00'),
    ]);

    $failedPaymentSession = PhotoboothSession::factory()->create([
        'photo_template_id' => $activeTemplate->id,
        'status' => PhotoboothSessionStatus::PaymentPending,
        'payment_method' => PaymentMethod::Maya,
        'price' => '20.00',
        'currency' => 'PHP',
        'started_at' => now()->subMinutes(15),
        'created_at' => now()->subMinutes(15),
        'updated_at' => now()->subMinutes(15),
    ]);

    Payment::factory()->create([
        'photobooth_session_id' => $failedPaymentSession->id,
        'method' => PaymentMethod::Maya,
        'status' => PaymentStatus::Failed,
        'amount' => '20.00',
        'created_at' => now()->subMinutes(15),
        'updated_at' => now()->subMinutes(15),
    ]);

    $pendingPaymentSession = PhotoboothSession::factory()->create([
        'photo_template_id' => $activeTemplate->id,
        'status' => PhotoboothSessionStatus::PaymentPending,
        'payment_method' => PaymentMethod::Maya,
        'price' => '20.00',
        'currency' => 'PHP',
        'started_at' => now()->subMinutes(10),
        'created_at' => now()->subMinutes(10),
        'updated_at' => now()->subMinutes(10),
    ]);

    Payment::factory()->create([
        'photobooth_session_id' => $pendingPaymentSession->id,
        'method' => PaymentMethod::Maya,
        'status' => PaymentStatus::Pending,
        'amount' => '20.00',
        'created_at' => now()->subMinutes(10),
        'updated_at' => now()->subMinutes(10),
    ]);

    PrintJob::factory()->create([
        'photobooth_session_id' => $todayMayaSession->id,
        'status' => PrintJobStatus::Pending,
        'created_at' => now()->subMinutes(8),
        'updated_at' => now()->subMinutes(8),
    ]);

    PrintJob::factory()->failed()->create([
        'photobooth_session_id' => $todayVoucherSession->id,
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
                ->where('period.startDate', '2026-08-17')
                ->where('period.endDate', '2026-08-23')
                ->where('summary.today.count', 2)
                ->where('summary.today.salesTotal', '100.00')
                ->where('summary.thisMonth.count', 4)
                ->where('summary.thisMonth.salesTotal', '230.00')
                ->where('summary.comparison.todaySalesVsYesterday', 25)
                ->where('summary.comparison.todaySessionsVsYesterday', 100)
                ->where('summary.comparison.monthSalesVsPreviousPeriod', 91.7)
                ->where('summary.needsAttention.failedPayments', 1)
                ->where('summary.needsAttention.pendingPayments', 1)
                ->where('summary.needsAttention.pendingPaymentTotal', '20.00')
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
                ->has('recentSessions', 5)
                ->where(
                    'recentSessions.0.reference',
                    sprintf('TS-%06d', $pendingPaymentSession->id),
                )
                ->where('recentSessions.0.paymentMethod', 'maya')
                ->where('recentSessions.0.status', 'payment_pending')
                ->where('recentSessions.0.amount', '20.00')
                ->where('recentSessions.0.currency', 'PHP')
                ->where('resources.templates.active', 2)
                ->where('resources.templates.inactive', 1)
                ->where('resources.stickers.active', 2)
                ->where('resources.stickers.inactive', 1)
                ->where('resources.vouchers.available', 2)
                ->where('resources.vouchers.remainingUses', 5),
        );
});

test('dashboard does not fabricate percentage comparisons without a prior baseline', function () {
    $this->travelTo(Carbon::parse('2026-08-23 12:00:00'));

    $user = User::factory()->create();
    $template = PhotoTemplate::factory()->create();

    $session = PhotoboothSession::factory()->create([
        'photo_template_id' => $template->id,
        'status' => PhotoboothSessionStatus::Completed,
        'payment_method' => PaymentMethod::Maya,
        'price' => '100.00',
        'currency' => 'PHP',
        'created_at' => now()->subHour(),
        'updated_at' => now()->subHour(),
    ]);

    Payment::factory()->success()->create([
        'photobooth_session_id' => $session->id,
        'method' => PaymentMethod::Maya,
        'amount' => '100.00',
        'created_at' => now()->subHour(),
        'updated_at' => now()->subHour(),
    ]);

    $this->actingAs($user)
        ->get(route('admin.dashboard'))
        ->assertOk()
        ->assertInertia(
            fn (Assert $page) => $page
                ->where('summary.comparison.todaySalesVsYesterday', null)
                ->where('summary.comparison.todaySessionsVsYesterday', null)
                ->where('summary.comparison.monthSalesVsPreviousPeriod', null)
                ->where('summary.needsAttention.pendingPaymentTotal', '0.00'),
        );
});

test('dashboard presents PayMongo QR Ph payment activity with the canonical method label', function () {
    $user = User::factory()->create();

    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::PaymentPending,
        'payment_method' => PaymentMethod::PayMongoQrPh,
        'price' => '150.00',
        'currency' => 'PHP',
        'started_at' => now()->subMinute(),
        'created_at' => now()->subMinute(),
        'updated_at' => now()->subMinute(),
    ]);

    Payment::factory()->create([
        'photobooth_session_id' => $session->id,
        'method' => PaymentMethod::PayMongoQrPh,
        'status' => PaymentStatus::Pending,
        'amount' => '150.00',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $this->actingAs($user)
        ->get(route('admin.dashboard'))
        ->assertOk()
        ->assertInertia(
            fn (Assert $page) => $page
                ->where('recentActivity.0.type', 'payment_pending')
                ->where(
                    'recentActivity.0.description',
                    'PHP 150.00 via PayMongo QR Ph',
                ),
        );
});
