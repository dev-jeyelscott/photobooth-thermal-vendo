<?php

use App\Http\Controllers\CaptureShotController;
use App\Http\Controllers\ColorCompositionController;
use App\Http\Controllers\GalleryController;
use App\Http\Controllers\KioskController;
use App\Http\Controllers\KioskRedirectController;
use App\Http\Controllers\MayaWebhookController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\PayMongoWebhookController;
use App\Http\Controllers\PhotoboothSessionController;
use App\Http\Controllers\PhotoTemplateController;
use App\Http\Controllers\PreviewController;
use App\Http\Controllers\StickerDesignController;
use App\Http\Controllers\VoucherController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::get('kiosk', KioskRedirectController::class)->name('kiosk');

Route::prefix('b/{business:slug}')
    ->scopeBindings()
    ->group(function (): void {
        Route::get('kiosk', KioskController::class)
            ->name('business.kiosk');

        Route::post('kiosk/sessions', [
            PhotoboothSessionController::class,
            'store',
        ])
            ->middleware('throttle:session-creation')
            ->name('kiosk.sessions.store');

        Route::get('templates', [
            PhotoTemplateController::class,
            'index',
        ])->name('templates.index');

        Route::get('stickers', [
            StickerDesignController::class,
            'index',
        ])->name('stickers.index');

        Route::get(
            'kiosk/sessions/{photoboothSession:session_token}',
            [PhotoboothSessionController::class, 'show'],
        )
            ->whereUuid('photoboothSession')
            ->name('kiosk.sessions.show');

        Route::post(
            'kiosk/sessions/{photoboothSession:session_token}/payments',
            [PaymentController::class, 'store'],
        )
            ->whereUuid('photoboothSession')
            ->middleware('throttle:payment-creation')
            ->name('kiosk.sessions.payments.store');

        Route::post(
            'kiosk/sessions/{photoboothSession:session_token}/voucher',
            [VoucherController::class, 'store'],
        )
            ->whereUuid('photoboothSession')
            ->middleware('throttle:voucher-redemption')
            ->name('kiosk.sessions.voucher.store');

        Route::post(
            'kiosk/sessions/{photoboothSession:session_token}/template',
            [PhotoTemplateController::class, 'store'],
        )
            ->whereUuid('photoboothSession')
            ->name('kiosk.sessions.template.store');

        Route::post(
            'kiosk/sessions/{photoboothSession:session_token}/sticker',
            [StickerDesignController::class, 'store'],
        )
            ->whereUuid('photoboothSession')
            ->name('kiosk.sessions.sticker.store');

        Route::post(
            'kiosk/sessions/{photoboothSession:session_token}/preview',
            [PreviewController::class, 'store'],
        )
            ->whereUuid('photoboothSession')
            ->name('kiosk.sessions.preview.store');

        Route::post(
            'kiosk/sessions/{photoboothSession:session_token}/shots',
            [CaptureShotController::class, 'store'],
        )
            ->whereUuid('photoboothSession')
            ->name('kiosk.sessions.shots.store');

        Route::post(
            'kiosk/sessions/{photoboothSession:session_token}/color-output',
            [ColorCompositionController::class, 'store'],
        )
            ->whereUuid('photoboothSession')
            ->name('kiosk.sessions.color-output.store');
    });

Route::get(
    'gallery/{capturedMedia:public_token}',
    [GalleryController::class, 'show'],
)->name('gallery.show');

Route::get(
    'gallery/{capturedMedia:public_token}/media/{variant}',
    [GalleryController::class, 'media'],
)->name('gallery.media');

Route::get(
    'gallery/{capturedMedia:public_token}/qr-code',
    [GalleryController::class, 'qrCode'],
)->name('gallery.qr-code');

Route::post(
    'webhooks/paymongo/{paymongoAccount:public_id}',
    PayMongoWebhookController::class,
)
    ->whereUuid('paymongoAccount')
    ->name('webhooks.paymongo');

Route::post(
    'webhooks/maya',
    [MayaWebhookController::class, 'handle'],
)->name('webhooks.maya');

require __DIR__.'/settings.php';
require __DIR__.'/admin.php';
