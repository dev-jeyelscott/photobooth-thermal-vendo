<?php

use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::inertia('kiosk', 'kiosk', [
    'idleTimeoutSeconds' => config('photobooth.kiosk_idle_timeout_seconds'),
])->name('kiosk');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
});

require __DIR__.'/settings.php';
