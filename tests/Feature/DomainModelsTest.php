<?php

use App\Enums\PaymentMethod;
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
use App\Models\Voucher;

test('photobooth session has a unique non-sequential session token and casts status to enum', function () {
    $session = PhotoboothSession::factory()->create();

    expect($session->session_token)->toBeString()
        ->and($session->session_token)->not->toBe((string) $session->id)
        ->and($session->status)->toBeInstanceOf(PhotoboothSessionStatus::class)
        ->and($session->status)->toBe(PhotoboothSessionStatus::New);
});

test('photobooth session belongs to a photo template', function () {
    $template = PhotoTemplate::factory()->create();
    $session = PhotoboothSession::factory()->for($template, 'photoTemplate')->create();

    expect($session->photoTemplate)->toBeInstanceOf(PhotoTemplate::class)
        ->and($session->photoTemplate->id)->toBe($template->id);
});

test('photobooth session belongs to a nullable voucher', function () {
    $session = PhotoboothSession::factory()->create(['voucher_id' => null]);

    expect($session->voucher)->toBeNull();

    $voucher = Voucher::factory()->create();
    $session->update(['voucher_id' => $voucher->id]);

    expect($session->fresh()->voucher)->toBeInstanceOf(Voucher::class)
        ->and($session->fresh()->voucher->id)->toBe($voucher->id);
});

test('photobooth session has one payment with method and status enum casts', function () {
    $session = PhotoboothSession::factory()->create();
    $payment = Payment::factory()->for($session, 'photoboothSession')->create();

    expect($session->fresh()->payment)->toBeInstanceOf(Payment::class)
        ->and($session->fresh()->payment->id)->toBe($payment->id)
        ->and($payment->method)->toBeInstanceOf(PaymentMethod::class)
        ->and($payment->status)->toBeInstanceOf(PaymentStatus::class)
        ->and($payment->photoboothSession->id)->toBe($session->id);
});

test('photobooth session has many captured media', function () {
    $session = PhotoboothSession::factory()->create();
    CapturedMedia::factory()->count(2)->for($session, 'photoboothSession')->create();

    expect($session->fresh()->capturedMedia)->toHaveCount(2)
        ->and($session->fresh()->capturedMedia->first())->toBeInstanceOf(CapturedMedia::class);
});

test('photobooth session has one print job with status enum cast', function () {
    $session = PhotoboothSession::factory()->create();
    $printJob = PrintJob::factory()->for($session, 'photoboothSession')->create();

    expect($session->fresh()->printJob)->toBeInstanceOf(PrintJob::class)
        ->and($session->fresh()->printJob->id)->toBe($printJob->id)
        ->and($printJob->status)->toBeInstanceOf(PrintJobStatus::class)
        ->and($printJob->status)->toBe(PrintJobStatus::Pending);
});

test('voucher tracks usage and expiry', function () {
    $voucher = Voucher::factory()->create(['usage_limit' => 5, 'usage_count' => 1]);

    expect($voucher->active)->toBeTrue()
        ->and($voucher->usage_limit)->toBe(5)
        ->and($voucher->usage_count)->toBe(1)
        ->and($voucher->expires_at)->not->toBeNull();
});

test('sticker design belongs to photobooth sessions', function () {
    $sticker = StickerDesign::factory()->create();
    $session = PhotoboothSession::factory()->for($sticker, 'stickerDesign')->create();

    expect($session->stickerDesign->id)->toBe($sticker->id)
        ->and($sticker->photoboothSessions->first()->id)->toBe($session->id);
});

test('application setting stores key value pairs', function () {
    $setting = ApplicationSetting::factory()->create(['key' => 'printer.name', 'value' => 'Star TSP143']);

    expect(ApplicationSetting::where('key', 'printer.name')->first()->value)->toBe('Star TSP143');
});
