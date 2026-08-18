<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Kiosk Idle Timeout
    |--------------------------------------------------------------------------
    |
    | Number of seconds of customer inactivity on the kiosk start screen
    | before the UI resets an abandoned session back to its idle state.
    |
    */

    'kiosk_idle_timeout_seconds' => env('PHOTOBOOTH_KIOSK_IDLE_TIMEOUT_SECONDS', 60),

    /*
    |--------------------------------------------------------------------------
    | Kiosk Session Lifetime
    |--------------------------------------------------------------------------
    |
    | Number of minutes a photobooth session remains valid after it starts
    | before it is automatically expired.
    |
    */

    'kiosk_session_ttl_minutes' => env('PHOTOBOOTH_KIOSK_SESSION_TTL_MINUTES', 15),

];
