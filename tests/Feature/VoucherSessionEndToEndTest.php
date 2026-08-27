<?php

use App\Enums\PaymentMethod;
use App\Enums\PhotoboothSessionStatus;
use App\Enums\PrintJobStatus;
use App\Models\CapturedMedia;
use App\Models\Payment;
use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use App\Models\PrintJob;
use App\Models\StickerDesign;
use App\Models\Voucher;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

function voucherSessionEndToEndFixturePng(int $red): string
{
    $image = imagecreatetruecolor(200, 200);
    imagefill($image, 0, 0, imagecolorallocate($image, $red, 60, 60));
    ob_start();
    imagepng($image);
    imagedestroy($image);

    return ob_get_clean();
}

test('the full voucher commercial journey succeeds end to end without Maya', function () {
    Storage::fake('public');
    Http::fake();

    $voucher = Voucher::factory()->create(['usage_limit' => 1, 'usage_count' => 0]);
    $template = PhotoTemplate::factory()->create([
        'layout_path' => 'templates/voucher-e2e-template.png',
        'photo_slots' => 2,
        'layout_config' => [
            'slots' => [
                ['slot' => 1, 'x' => 0, 'y' => 0, 'width' => 50, 'height' => 50],
                ['slot' => 2, 'x' => 50, 'y' => 0, 'width' => 50, 'height' => 50],
            ],
        ],
        'print_width_mm' => 100,
        'print_height_mm' => 50,
    ]);
    Storage::disk('public')->put('templates/voucher-e2e-template.png', voucherSessionEndToEndFixturePng(240));

    $sticker = StickerDesign::factory()->create(['asset_path' => 'stickers/voucher-e2e-sticker.png']);
    Storage::disk('public')->put('stickers/voucher-e2e-sticker.png', voucherSessionEndToEndFixturePng(80));

    $sessionToken = $this->postJson(route('kiosk.sessions.store'))
        ->assertCreated()
        ->json('sessionToken');

    $session = PhotoboothSession::where('session_token', $sessionToken)->firstOrFail();
    expect($session->status)->toBe(PhotoboothSessionStatus::New);

    $this->postJson(route('kiosk.sessions.voucher.store', $sessionToken), [
        'code' => $voucher->code,
    ])->assertOk()->assertJson(['status' => PhotoboothSessionStatus::Paid->value]);

    $session->refresh();
    expect($session->status)->toBe(PhotoboothSessionStatus::Paid)
        ->and($session->voucher_id)->toBe($voucher->id)
        ->and($session->payment_method)->toBe(PaymentMethod::Voucher)
        ->and($session->price)->toBe('0.00')
        ->and($voucher->fresh()->usage_count)->toBe(1)
        ->and(Payment::count())->toBe(0);

    $this->postJson(route('kiosk.sessions.template.store', $sessionToken), [
        'photoTemplateId' => $template->id,
    ])->assertOk()->assertJson([
        'status' => PhotoboothSessionStatus::TemplateSelected->value,
        'requiredCaptureCount' => 2,
    ]);

    $photoPaths = [];
    $requiredCaptureCount = $session->fresh()->template_snapshot['photo_slots'];

    for ($i = 0; $i < $requiredCaptureCount; $i++) {
        $photoPaths[] = $this->postJson(route('kiosk.sessions.shots.store', $sessionToken), [
            'shot' => UploadedFile::fake()->image("voucher-shot-{$i}.jpg", 800, 600),
        ])->assertOk()->json('path');
    }

    $this->postJson(route('kiosk.sessions.sticker.store', $sessionToken), [
        'stickerDesignId' => $sticker->id,
    ])->assertOk();

    $this->postJson(route('kiosk.sessions.preview.store', $sessionToken))
        ->assertOk()
        ->assertJson(['status' => PhotoboothSessionStatus::Processing->value]);

    $this->postJson(route('kiosk.sessions.color-output.store', $sessionToken), [
        'photo_paths' => $photoPaths,
    ])->assertStatus(202);

    $session->refresh();
    $capturedMedia = CapturedMedia::where('photobooth_session_id', $session->id)->firstOrFail();
    $printJob = PrintJob::where('photobooth_session_id', $session->id)->firstOrFail();

    expect($session->status)->toBe(PhotoboothSessionStatus::Completed)
        ->and($voucher->fresh()->usage_count)->toBe(1)
        ->and($session->fresh()->voucher_id)->toBe($voucher->id)
        ->and(PrintJob::where('photobooth_session_id', $session->id)->count())->toBe(1)
        ->and($printJob->status)->toBe(PrintJobStatus::Printed)
        ->and($printJob->attempt_count)->toBe(1)
        ->and(Payment::count())->toBe(0);

    $this->get(route('gallery.show', $capturedMedia->public_token))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('gallery')
            ->where('colorUrl', route('gallery.media', [
                'capturedMedia' => $capturedMedia->public_token,
                'variant' => 'color',
            ]))
        );

    $this->get(route('gallery.qr-code', $capturedMedia->public_token))->assertOk();

    $this->getJson(route('kiosk.sessions.show', $sessionToken))
        ->assertOk()
        ->assertJson([
            'status' => PhotoboothSessionStatus::Completed->value,
            'galleryToken' => $capturedMedia->public_token,
        ]);

    Http::assertNotSent(fn (Request $request): bool => str_contains($request->url(), 'paymaya.com'));
});
