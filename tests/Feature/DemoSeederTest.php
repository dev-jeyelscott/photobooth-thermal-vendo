<?php

use App\Enums\PaymentStatus;
use App\Enums\PhotoboothSessionStatus;
use App\Enums\PrintJobStatus;
use App\Models\ApplicationSetting;
use App\Models\CapturedMedia;
use App\Models\Payment;
use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use App\Models\PrintJob;
use App\Models\StickerDesign;
use App\Models\User;
use App\Models\Voucher;
use Database\Seeders\DemoSeeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Storage::fake('public');
});

test('demo seeder creates coherent demo data and working public assets', function () {
    $this->seed(DemoSeeder::class);

    $admin = User::query()->where('email', 'demo@thermasnap.local')->firstOrFail();

    expect($admin->email_verified_at)->not->toBeNull()
        ->and(Hash::check('ThermaSnapDemo!2026', $admin->password))->toBeTrue()
        ->and(ApplicationSetting::query()->where('key', 'booth_display_name')->value('value'))->toBe('ThermaSnap Demo Booth')
        ->and(ApplicationSetting::query()->where('key', 'session_price')->value('value'))->toBe('50.00');

    $template = PhotoTemplate::query()->where('slug', 'thermasnap-classic-strip')->firstOrFail();
    $sticker = StickerDesign::query()->where('name', 'Confetti Corner')->firstOrFail();

    Storage::disk('public')->assertExists($template->layout_path);
    Storage::disk('public')->assertExists((string) $template->thumbnail_path);
    Storage::disk('public')->assertExists($sticker->asset_path);
    Storage::disk('public')->assertExists((string) $sticker->thumbnail_path);

    expect(PhotoTemplate::query()->where('active', true)->count())->toBeGreaterThanOrEqual(3)
        ->and(PhotoTemplate::query()->where('active', false)->count())->toBeGreaterThanOrEqual(1)
        ->and(StickerDesign::query()->where('active', true)->count())->toBeGreaterThanOrEqual(3)
        ->and($sticker->photoTemplates()->count())->toBe(2);

    $friends = Voucher::query()->where('code', 'THERMA-FRIENDS')->firstOrFail();
    $soldOut = Voucher::query()->where('code', 'THERMA-SOLDOUT')->firstOrFail();
    $future = Voucher::query()->where('code', 'THERMA-NEXT')->firstOrFail();

    expect($friends->usage_count)->toBe(2)
        ->and($friends->photoboothSessions()->count())->toBe(2)
        ->and($soldOut->usage_count)->toBe($soldOut->usage_limit)
        ->and($future->valid_from?->isFuture())->toBeTrue();

    foreach ([
        PhotoboothSessionStatus::New,
        PhotoboothSessionStatus::PaymentPending,
        PhotoboothSessionStatus::Paid,
        PhotoboothSessionStatus::Capturing,
        PhotoboothSessionStatus::Printing,
        PhotoboothSessionStatus::Completed,
        PhotoboothSessionStatus::Expired,
        PhotoboothSessionStatus::Abandoned,
    ] as $status) {
        expect(PhotoboothSession::query()->where('status', $status->value)->exists())->toBeTrue();
    }

    foreach ([PaymentStatus::Pending, PaymentStatus::Success, PaymentStatus::Failed, PaymentStatus::Cancelled] as $status) {
        expect(Payment::query()->where('status', $status->value)->exists())->toBeTrue();
    }

    foreach ([PrintJobStatus::Pending, PrintJobStatus::Printed, PrintJobStatus::Failed] as $status) {
        expect(PrintJob::query()->where('status', $status->value)->exists())->toBeTrue();
    }

    $media = CapturedMedia::query()->firstOrFail();

    expect($media->public_token)->not->toBeNull();
    Storage::disk('public')->assertExists($media->color_path);
    Storage::disk('public')->assertExists($media->bw_path);
    Storage::disk('public')->assertExists($media->gif_path);
});

test('demo seeder feeds meaningful dashboard and daily report data', function () {
    $this->seed(DemoSeeder::class);

    $admin = User::query()->where('email', 'demo@thermasnap.local')->firstOrFail();

    $this->actingAs($admin)
        ->get(route('admin.dashboard'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('admin/dashboard')
            ->where('summary.today.count', fn ($count) => $count >= 5)
            ->where('summary.today.salesTotal', fn ($sales) => (float) $sales >= 150.00)
            ->where('summary.needsAttention.failedPayments', 1)
            ->where('summary.needsAttention.failedPrintJobs', 1)
            ->where('summary.needsAttention.pendingPayments', 1)
            ->where('recentActivity', fn ($activity) => count($activity) > 0)
        );

    $this->actingAs($admin)
        ->get(route('admin.reports.daily', ['date' => now()->toDateString()]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('admin/reports/daily')
            ->where('report.grossSales', fn ($sales) => (float) $sales >= 150.00)
            ->where('report.successfulSessions', fn ($count) => $count >= 5)
            ->where('report.paidSessions', fn ($count) => $count >= 3)
            ->where('report.voucherSessions', fn ($count) => $count >= 2)
            ->where('report.failedPayments', 1)
            ->where('report.averageTransactionValue', fn ($average) => (float) $average > 0)
        );
});

test('demo seeder can be rerun without duplicating its deterministic records', function () {
    $this->seed(DemoSeeder::class);
    $this->seed(DemoSeeder::class);

    expect(User::query()->where('email', 'demo@thermasnap.local')->count())->toBe(1)
        ->and(PhotoTemplate::query()->where('slug', 'thermasnap-classic-strip')->count())->toBe(1)
        ->and(Voucher::query()->where('code', 'THERMA-FRIENDS')->count())->toBe(1)
        ->and(PhotoboothSession::query()->whereIn('session_token', [
            '11111111-1111-4111-8111-000000000001',
            '11111111-1111-4111-8111-000000000019',
        ])->count())->toBe(2);
});
