<?php

use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\ColorCompositionController;
use App\Http\Controllers\GalleryController;
use App\Http\Controllers\MayaWebhookController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\PhotoboothSessionController;
use App\Http\Controllers\PhotoTemplateController;
use App\Http\Controllers\PreviewController;
use App\Http\Controllers\StickerDesignController;
use App\Http\Controllers\VoucherController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::inertia('kiosk', 'kiosk', [
    'idleTimeoutSeconds' => config('photobooth.kiosk_idle_timeout_seconds'),
    'captureShotCount' => config('photobooth.capture_shot_count'),
    'captureRetakeLimit' => config('photobooth.capture_retake_limit'),
    'paymentTimeoutSeconds' => config('photobooth.payment_timeout_seconds'),
])->name('kiosk');

Route::post('kiosk/sessions', [PhotoboothSessionController::class, 'store'])->name('kiosk.sessions.store');
Route::get('kiosk/sessions/{sessionToken}', [PhotoboothSessionController::class, 'show'])
    ->whereUuid('sessionToken')
    ->name('kiosk.sessions.show');

Route::post('kiosk/sessions/{sessionToken}/payments', [PaymentController::class, 'store'])
    ->whereUuid('sessionToken')
    ->middleware('throttle:payment-creation')
    ->name('kiosk.sessions.payments.store');

Route::post('kiosk/sessions/{sessionToken}/voucher', [VoucherController::class, 'store'])
    ->whereUuid('sessionToken')
    ->middleware('throttle:voucher-redemption')
    ->name('kiosk.sessions.voucher.store');

Route::get('templates', [PhotoTemplateController::class, 'index'])->name('templates.index');

Route::post('kiosk/sessions/{sessionToken}/template', [PhotoTemplateController::class, 'store'])
    ->whereUuid('sessionToken')
    ->name('kiosk.sessions.template.store');

Route::get('stickers', [StickerDesignController::class, 'index'])->name('stickers.index');

Route::post('kiosk/sessions/{sessionToken}/sticker', [StickerDesignController::class, 'store'])
    ->whereUuid('sessionToken')
    ->name('kiosk.sessions.sticker.store');

Route::post('kiosk/sessions/{sessionToken}/preview', [PreviewController::class, 'store'])
    ->whereUuid('sessionToken')
    ->name('kiosk.sessions.preview.store');

Route::post('kiosk/sessions/{sessionToken}/color-output', [ColorCompositionController::class, 'store'])
    ->whereUuid('sessionToken')
    ->name('kiosk.sessions.color-output.store');

Route::get('gallery/{capturedMedia:public_token}', [GalleryController::class, 'show'])->name('gallery.show');

Route::get('gallery/{capturedMedia:public_token}/qr-code', [GalleryController::class, 'qrCode'])->name('gallery.qr-code');

Route::post('webhooks/maya', [MayaWebhookController::class, 'handle'])->name('webhooks.maya');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');
});

require __DIR__.'/settings.php';
require __DIR__.'/admin.php';
