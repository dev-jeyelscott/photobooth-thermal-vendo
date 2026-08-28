<?php

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PayMongoMode;
use App\Enums\PhotoboothSessionStatus;
use App\Enums\PrintJobStatus;
use App\Models\CapturedMedia;
use App\Models\Payment;
use App\Models\PayMongoAccount;
use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use App\Models\PrintJob;
use App\Models\StickerDesign;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * Generate a deterministic PNG fixture used by the paid-session media pipeline.
 */
function paidSessionEndToEndFixturePng(int $red): string
{
    $image = imagecreatetruecolor(200, 200);
    imagefill($image, 0, 0, imagecolorallocate($image, $red, 60, 60));
    ob_start();
    imagepng($image);
    imagedestroy($image);

    return ob_get_clean();
}

test('the paid commercial journey continues end to end after PayMongo QR creation and trusted payment confirmation', function () {
    Storage::fake('public');

    config()->set('services.paymongo.api_base_url', 'https://api.paymongo.com');

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

    Storage::disk('public')->put(
        'templates/e2e-template.png',
        paidSessionEndToEndFixturePng(240),
    );

    $sticker = StickerDesign::factory()->create([
        'asset_path' => 'stickers/e2e-sticker.png',
    ]);

    Storage::disk('public')->put(
        'stickers/e2e-sticker.png',
        paidSessionEndToEndFixturePng(80),
    );

    // 1. Start the session through the real business-scoped kiosk endpoint.
    $sessionToken = $this->postJson(businessRoute('kiosk.sessions.store'))
        ->assertCreated()
        ->json('sessionToken');

    $session = PhotoboothSession::query()
        ->where('session_token', $sessionToken)
        ->firstOrFail();

    expect($session->status)->toBe(PhotoboothSessionStatus::New);

    // 2. Configure the exact tenant PayMongo account required by TH-PAY-004.
    $business = $session->business;

    $account = PayMongoAccount::factory()
        ->for($business)
        ->webhookProvisioned()
        ->create();

    $business->forceFill([
        'active_paymongo_mode' => PayMongoMode::Test,
        'test_paymongo_account_id' => $account->id,
    ])->save();

    // 3. Create the native PayMongo QR Ph resources.
    Http::fake([
        'https://api.paymongo.com/v1/payment_intents' => Http::response([
            'data' => [
                'id' => 'pi_e2e',
                'attributes' => [
                    'client_key' => 'pi_e2e_client_key',
                    'status' => 'awaiting_payment_method',
                    'payments' => [],
                ],
            ],
        ], 200),

        'https://api.paymongo.com/v1/payment_methods' => Http::response([
            'data' => [
                'id' => 'pm_e2e',
                'attributes' => [
                    'type' => 'qrph',
                ],
            ],
        ], 200),

        'https://api.paymongo.com/v1/payment_intents/pi_e2e/attach' => Http::response([
            'data' => [
                'id' => 'pi_e2e',
                'attributes' => [
                    'status' => 'awaiting_next_action',
                    'payments' => [
                        ['id' => 'pay_e2e'],
                    ],
                    'next_action' => [
                        'code' => [
                            'image_url' => 'data:image/png;base64,ZTJlLXFycGg=',
                        ],
                    ],
                ],
            ],
        ], 200),
    ]);

    $this->postJson(
        kioskSessionRoute(
            'kiosk.sessions.payments.store',
            $sessionToken,
        ),
    )
        ->assertCreated()
        ->assertJsonPath(
            'qrImageUrl',
            'data:image/png;base64,ZTJlLXFycGg=',
        )
        ->assertJsonPath(
            'payment.providerStatus',
            'awaiting_next_action',
        );

    $payment = Payment::firstOrFail();

    expect($payment->status)->toBe(PaymentStatus::Pending)
        ->and($payment->method)->toBe(PaymentMethod::PayMongoQrPh)
        ->and($payment->paymongo_account_id)->toBe($account->id)
        ->and($payment->paymongo_payment_intent_id)->toBe('pi_e2e')
        ->and($payment->paymongo_payment_method_id)->toBe('pm_e2e')
        ->and($payment->paymongo_payment_id)->toBe('pay_e2e')
        ->and($session->fresh()->status)
        ->toBe(PhotoboothSessionStatus::PaymentPending);

    // 4. TH-PAY-005 owns signed webhook application. Until that slice lands,
    // establish the same trusted durable success state so this test continues
    // covering the downstream commercial journey without reusing Maya.
    DB::transaction(function () use ($payment, $session): void {
        $payment->update([
            'status' => PaymentStatus::Success,
            'provider_status' => 'paid',
            'paid_at' => now(),
        ]);

        $session->refresh()->transitionTo(
            PhotoboothSessionStatus::Paid,
        );
    });

    expect($payment->fresh()->status)->toBe(PaymentStatus::Success)
        ->and($session->fresh()->status)->toBe(PhotoboothSessionStatus::Paid)
        ->and(
            PhotoboothSession::query()
                ->where('status', PhotoboothSessionStatus::Paid)
                ->count(),
        )->toBe(1);

    // 5. Select the template.
    $this->postJson(
        kioskSessionRoute(
            'kiosk.sessions.template.store',
            $sessionToken,
        ),
        [
            'photoTemplateId' => $template->id,
        ],
    )
        ->assertOk()
        ->assertJson([
            'status' => PhotoboothSessionStatus::TemplateSelected->value,
            'requiredCaptureCount' => 2,
        ]);

    // 6. Upload captures for the required shot count.
    $requiredCaptureCount = $session->fresh()
        ->template_snapshot['photo_slots'];

    $photoPaths = [];

    for ($i = 0; $i < $requiredCaptureCount; $i++) {
        $photoPaths[] = $this->postJson(
            kioskSessionRoute(
                'kiosk.sessions.shots.store',
                $sessionToken,
            ),
            [
                'shot' => UploadedFile::fake()
                    ->image("shot-{$i}.jpg", 800, 600),
            ],
        )
            ->assertOk()
            ->json('path');
    }

    // 7. Select a sticker after capture, then confirm the preview.
    $this->postJson(
        kioskSessionRoute(
            'kiosk.sessions.sticker.store',
            $sessionToken,
        ),
        [
            'stickerDesignId' => $sticker->id,
        ],
    )->assertOk();

    $this->postJson(
        kioskSessionRoute(
            'kiosk.sessions.preview.store',
            $sessionToken,
        ),
    )
        ->assertOk()
        ->assertJson([
            'status' => PhotoboothSessionStatus::Processing->value,
        ]);

    // 8. Compose the uploaded frames. The sync queue processes media and print.
    $this->postJson(
        kioskSessionRoute(
            'kiosk.sessions.color-output.store',
            $sessionToken,
        ),
        [
            'photo_paths' => $photoPaths,
        ],
    )->assertStatus(202);

    $session->refresh();

    expect($session->status)->toBe(
        PhotoboothSessionStatus::Completed,
    );

    $capturedMedia = CapturedMedia::query()
        ->where('photobooth_session_id', $session->id)
        ->firstOrFail();

    $printJob = PrintJob::query()
        ->where('photobooth_session_id', $session->id)
        ->firstOrFail();

    expect(
        PrintJob::query()
            ->where('photobooth_session_id', $session->id)
            ->count(),
    )
        ->toBe(1)
        ->and($printJob->status)
        ->toBe(PrintJobStatus::Printed);

    // 9. Confirm exactly one successful payment and completed session.
    expect(Payment::count())->toBe(1)
        ->and(
            Payment::query()
                ->where('status', PaymentStatus::Success)
                ->count(),
        )->toBe(1)
        ->and(
            PhotoboothSession::query()
                ->where('status', PhotoboothSessionStatus::Completed)
                ->count(),
        )->toBe(1);

    // 10. Confirm the gallery and QR remain available after completion.
    $galleryResponse = $this->get(
        route(
            'gallery.show',
            $capturedMedia->public_token,
        ),
    );

    $galleryResponse->assertOk();

    $galleryResponse->assertInertia(
        fn (Assert $page) => $page
            ->component('gallery')
            ->where(
                'colorUrl',
                route('gallery.media', [
                    'capturedMedia' => $capturedMedia->public_token,
                    'variant' => 'color',
                ]),
            ),
    );

    $this->get(
        route(
            'gallery.qr-code',
            $capturedMedia->public_token,
        ),
    )->assertOk();

    $resumed = $this->getJson(
        kioskSessionRoute(
            'kiosk.sessions.show',
            $sessionToken,
        ),
    );

    $resumed
        ->assertOk()
        ->assertJson([
            'status' => PhotoboothSessionStatus::Completed->value,
            'galleryToken' => $capturedMedia->public_token,
        ]);
});
