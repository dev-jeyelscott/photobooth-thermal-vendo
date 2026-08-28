<?php

use App\Enums\PaymentStatus;
use App\Enums\PhotoboothSessionStatus;
use App\Enums\PrintJobStatus;
use App\Models\CapturedMedia;
use App\Models\Payment;
use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use App\Models\PrintJob;
use App\Models\StickerDesign;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

function paidSessionEndToEndFixturePng(int $red): string
{
    $image = imagecreatetruecolor(200, 200);
    imagefill($image, 0, 0, imagecolorallocate($image, $red, 60, 60));
    ob_start();
    imagepng($image);
    imagedestroy($image);

    return ob_get_clean();
}

test('the full paid commercial journey succeeds end to end through real application entry points', function () {
    Storage::fake('public');
    config(['services.maya.webhook_secret' => 'whsec_e2e_secret']);

    $template = PhotoTemplate::factory()->create([
        'layout_path' => 'templates/e2e-template.png',
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
    Storage::disk('public')->put('templates/e2e-template.png', paidSessionEndToEndFixturePng(240));

    $sticker = StickerDesign::factory()->create(['asset_path' => 'stickers/e2e-sticker.png']);
    Storage::disk('public')->put('stickers/e2e-sticker.png', paidSessionEndToEndFixturePng(80));

    // 1. Start the session.
    $sessionToken = $this->postJson(businessRoute('kiosk.sessions.store'))
        ->assertCreated()
        ->json('sessionToken');

    $session = PhotoboothSession::where('session_token', $sessionToken)->firstOrFail();
    expect($session->status)->toBe(PhotoboothSessionStatus::New);

    // 2. Create the Maya checkout.
    Http::fake([
        '*/checkout/v1/checkouts' => Http::response([
            'checkoutId' => 'checkout-e2e',
            'redirectUrl' => 'https://pg-sandbox.paymaya.com/checkout/checkout-e2e',
        ], 200),
    ]);

    $this->postJson(kioskSessionRoute('kiosk.sessions.payments.store', $sessionToken))
        ->assertCreated()
        ->assertJson(['checkoutUrl' => 'https://pg-sandbox.paymaya.com/checkout/checkout-e2e']);

    $payment = Payment::firstOrFail();
    expect($payment->status)->toBe(PaymentStatus::Pending)
        ->and($session->fresh()->status)->toBe(PhotoboothSessionStatus::New);

    // 3. Simulate the Maya success webhook.
    $payload = [
        'id' => 'maya-payment-e2e',
        'checkoutId' => 'checkout-e2e',
        'status' => 'PAYMENT_SUCCESS',
        'amount' => ['value' => (string) $payment->amount, 'currency' => $session->fresh()->currency],
    ];
    $signature = hash_hmac('sha256', json_encode($payload), 'whsec_e2e_secret');

    $this->postJson(route('webhooks.maya'), $payload, ['Maya-Webhook-Signature' => $signature])
        ->assertOk();

    expect(Payment::count())->toBe(1);
    $payment->refresh();
    expect($payment->status)->toBe(PaymentStatus::Success)
        ->and($session->fresh()->status)->toBe(PhotoboothSessionStatus::Paid)
        ->and(PhotoboothSession::where('status', PhotoboothSessionStatus::Paid)->count())->toBe(1);

    // 4. Select the template.
    $this->postJson(kioskSessionRoute('kiosk.sessions.template.store', $sessionToken), [
        'photoTemplateId' => $template->id,
    ])->assertOk()->assertJson([
        'status' => PhotoboothSessionStatus::TemplateSelected->value,
        'requiredCaptureCount' => 2,
    ]);

    // 5. Upload captures for the required shot count.
    $requiredCaptureCount = $session->fresh()->template_snapshot['photo_slots'];
    $photoPaths = [];

    for ($i = 0; $i < $requiredCaptureCount; $i++) {
        $photoPaths[] = $this->postJson(kioskSessionRoute('kiosk.sessions.shots.store', $sessionToken), [
            'shot' => UploadedFile::fake()->image("shot-{$i}.jpg", 800, 600),
        ])->assertOk()->json('path');
    }

    // 6. Select a sticker after capture, then confirm the preview.
    $this->postJson(kioskSessionRoute('kiosk.sessions.sticker.store', $sessionToken), [
        'stickerDesignId' => $sticker->id,
    ])->assertOk();

    $this->postJson(kioskSessionRoute('kiosk.sessions.preview.store', $sessionToken))
        ->assertOk()
        ->assertJson(['status' => PhotoboothSessionStatus::Processing->value]);

    // 7. Compose the uploaded frames, which synchronously (sync queue) processes
    // the captured media and creates/prints the print job.
    $this->postJson(kioskSessionRoute('kiosk.sessions.color-output.store', $sessionToken), [
        'photo_paths' => $photoPaths,
    ])->assertStatus(202);

    $session->refresh();
    expect($session->status)->toBe(PhotoboothSessionStatus::Completed);

    $capturedMedia = CapturedMedia::where('photobooth_session_id', $session->id)->firstOrFail();
    $printJob = PrintJob::where('photobooth_session_id', $session->id)->firstOrFail();

    expect(PrintJob::where('photobooth_session_id', $session->id)->count())->toBe(1)
        ->and($printJob->status)->toBe(PrintJobStatus::Printed);

    // 9. Confirm exactly one successful payment and one paid session resulted
    // from the simulated webhook.
    expect(Payment::count())->toBe(1)
        ->and(Payment::where('status', PaymentStatus::Success)->count())->toBe(1)
        ->and(PhotoboothSession::where('status', PhotoboothSessionStatus::Completed)->count())->toBe(1);

    // 10. Confirm the gallery and QR code are available for the completed session.
    $galleryResponse = $this->get(route('gallery.show', $capturedMedia->public_token));

    $galleryResponse->assertOk();
    $galleryResponse->assertInertia(fn (Assert $page) => $page
        ->component('gallery')
        ->where('colorUrl', route('gallery.media', [
            'capturedMedia' => $capturedMedia->public_token,
            'variant' => 'color',
        ]))
    );

    $this->get(route('gallery.qr-code', $capturedMedia->public_token))->assertOk();

    $resumed = $this->getJson(kioskSessionRoute('kiosk.sessions.show', $sessionToken));
    $resumed->assertOk()->assertJson([
        'status' => PhotoboothSessionStatus::Completed->value,
        'galleryToken' => $capturedMedia->public_token,
    ]);
});
