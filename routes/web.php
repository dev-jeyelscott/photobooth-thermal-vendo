<?php

use App\Http\Controllers\MayaWebhookController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\PhotoboothSessionController;
use App\Http\Controllers\VoucherController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::inertia('kiosk', 'kiosk', [
    'idleTimeoutSeconds' => config('photobooth.kiosk_idle_timeout_seconds'),
    'captureShotCount' => config('photobooth.capture_shot_count'),
    'captureRetakeLimit' => config('photobooth.capture_retake_limit'),
])->name('kiosk');

Route::post('kiosk/sessions', [PhotoboothSessionController::class, 'store'])->name('kiosk.sessions.store');
Route::get('kiosk/sessions/{sessionToken}', [PhotoboothSessionController::class, 'show'])
    ->whereUuid('sessionToken')
    ->name('kiosk.sessions.show');

Route::post('kiosk/sessions/{sessionToken}/payments', [PaymentController::class, 'store'])
    ->whereUuid('sessionToken')
    ->name('kiosk.sessions.payments.store');

Route::post('kiosk/sessions/{sessionToken}/voucher', [VoucherController::class, 'store'])
    ->whereUuid('sessionToken')
    ->name('kiosk.sessions.voucher.store');

Route::post('webhooks/maya', [MayaWebhookController::class, 'handle'])->name('webhooks.maya');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
});

require __DIR__.'/settings.php';
