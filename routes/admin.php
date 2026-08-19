<?php

use App\Http\Controllers\Admin\SessionMonitorController;
use App\Http\Controllers\Admin\SettingController;
use App\Http\Controllers\Admin\StickerController;
use App\Http\Controllers\Admin\TemplateController;
use App\Http\Controllers\Admin\VoucherController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])->prefix('admin')->name('admin.')->group(function () {
    Route::resource('templates', TemplateController::class)->except(['show']);
    Route::patch('templates/{template}/toggle', [TemplateController::class, 'toggle'])->name('templates.toggle');

    Route::resource('stickers', StickerController::class)->except(['show']);
    Route::patch('stickers/{sticker}/toggle', [StickerController::class, 'toggle'])->name('stickers.toggle');

    Route::resource('vouchers', VoucherController::class)->except(['show']);
    Route::patch('vouchers/{voucher}/toggle', [VoucherController::class, 'toggle'])->name('vouchers.toggle');

    Route::get('sessions', [SessionMonitorController::class, 'index'])->name('sessions.index');

    Route::get('settings', [SettingController::class, 'edit'])->name('settings.edit');
    Route::put('settings', [SettingController::class, 'update'])->name('settings.update');
});
