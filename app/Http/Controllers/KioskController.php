<?php

namespace App\Http\Controllers;

use App\Models\Business;
use App\Services\Settings;
use Inertia\Inertia;
use Inertia\Response;

class KioskController extends Controller
{
    /**
     * Render the public kiosk for the Business resolved from the tenant slug.
     */
    public function __invoke(Business $business): Response
    {
        return Inertia::render('kiosk', [
            'businessSlug' => $business->slug,
            'idleTimeoutSeconds' => config('photobooth.kiosk_idle_timeout_seconds'),
            'captureShotCount' => config('photobooth.capture_shot_count'),
            'captureRetakeLimit' => fn () => Settings::get('capture_retake_limit'),
            'captureCountdownSeconds' => fn () => Settings::get('capture_countdown_seconds'),
            'paymentTimeoutSeconds' => config('photobooth.payment_timeout_seconds'),
            'maintenanceMode' => fn () => Settings::get('maintenance_mode'),
            'maintenanceMessage' => fn () => Settings::get('maintenance_message'),
        ]);
    }
}
