<?php

use App\Http\Controllers\PhotoboothSessionController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::inertia('kiosk', 'kiosk', [
    'idleTimeoutSeconds' => config('photobooth.kiosk_idle_timeout_seconds'),
])->name('kiosk');

Route::post('kiosk/sessions', [PhotoboothSessionController::class, 'store'])->name('kiosk.sessions.store');
Route::get('kiosk/sessions/{sessionToken}', [PhotoboothSessionController::class, 'show'])
    ->whereUuid('sessionToken')
    ->name('kiosk.sessions.show');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
});

require __DIR__.'/settings.php';
