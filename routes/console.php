<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('photobooth:expire-sessions')->everyMinute();
Schedule::command('media:prune-expired')->hourly();
Schedule::command('payments:reconcile-stale-maya')->everyFiveMinutes()->withoutOverlapping();
