<?php

use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\PaymentController;
use App\Http\Controllers\Admin\PaymentSettingController;
use App\Http\Controllers\Admin\ReportController;
use App\Http\Controllers\Admin\SessionMonitorController;
use App\Http\Controllers\Admin\SettingController;
use App\Http\Controllers\Admin\StickerController;
use App\Http\Controllers\Admin\TemplateController;
use App\Http\Controllers\Admin\VoucherController;
use Illuminate\Auth\Middleware\RequirePassword;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])->prefix('admin')->name('admin.')->group(function () {
    Route::get('/', [DashboardController::class, 'index'])->name('dashboard');

    Route::patch('templates/reorder', [TemplateController::class, 'reorder'])->name('templates.reorder');
    Route::resource('templates', TemplateController::class)->except(['show']);
    Route::patch('templates/{template}/toggle', [TemplateController::class, 'toggle'])->name('templates.toggle');

    Route::patch('stickers/reorder', [StickerController::class, 'reorder'])->name('stickers.reorder');
    Route::resource('stickers', StickerController::class)->except(['show']);
    Route::patch('stickers/{sticker}/toggle', [StickerController::class, 'toggle'])->name('stickers.toggle');

    Route::resource('vouchers', VoucherController::class)->except(['show']);
    Route::patch('vouchers/{voucher}/toggle', [VoucherController::class, 'toggle'])->name('vouchers.toggle');

    Route::get('sessions', [SessionMonitorController::class, 'index'])->name('sessions.index');

    Route::get('payments', [PaymentController::class, 'index'])->name('payments.index');

    Route::get('payment-settings', [PaymentSettingController::class, 'edit'])
        ->name('payment-settings.edit');

    Route::put('payment-settings/{mode}', [PaymentSettingController::class, 'replace'])
        ->middleware(RequirePassword::class)
        ->name('payment-settings.replace');

    Route::post('payment-settings/{mode}/test', [PaymentSettingController::class, 'test'])
        ->name('payment-settings.test');

    Route::post('payment-settings/{mode}/activate', [PaymentSettingController::class, 'activate'])
        ->middleware(RequirePassword::class)
        ->name('payment-settings.activate');

    Route::get('reports/daily', [ReportController::class, 'daily'])->name('reports.daily');
    Route::get('reports/monthly', [ReportController::class, 'monthly'])->name('reports.monthly');
    Route::get('reports/range', [ReportController::class, 'range'])->name('reports.range');
    Route::get('reports/export', [ReportController::class, 'export'])->name('reports.export');

    Route::get('settings', [SettingController::class, 'edit'])->name('settings.edit');
    Route::put('settings', [SettingController::class, 'update'])->name('settings.update');
});
