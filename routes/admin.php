<?php

use App\Http\Controllers\Admin\TemplateController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'verified'])->prefix('admin')->name('admin.')->group(function () {
    Route::resource('templates', TemplateController::class)->except(['show']);
    Route::patch('templates/{template}/toggle', [TemplateController::class, 'toggle'])->name('templates.toggle');
});
