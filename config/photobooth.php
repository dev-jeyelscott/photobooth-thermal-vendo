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

    /*
    |--------------------------------------------------------------------------
    | Capture Shot Count
    |--------------------------------------------------------------------------
    |
    | Number of photos captured per photobooth session. This is a fixed MVP
    | default; template-driven shot counts arrive in a later phase.
    |
    */

    'capture_shot_count' => env('PHOTOBOOTH_CAPTURE_SHOT_COUNT', 3),

    /*
    |--------------------------------------------------------------------------
    | Capture Retake Limit
    |--------------------------------------------------------------------------
    |
    | Number of retakes a customer may take per shot before the flow forces
    | them to keep the current photo and advance to the next shot.
    |
    */

    'capture_retake_limit' => env('PHOTOBOOTH_CAPTURE_RETAKE_LIMIT', 2),

    /*
    |--------------------------------------------------------------------------
    | GIF Frame Duration
    |--------------------------------------------------------------------------
    |
    | Number of seconds each captured photo is displayed for in the animated
    | GIF generated for digital delivery.
    |
    */

    'gif_frame_duration_seconds' => env('PHOTOBOOTH_GIF_FRAME_DURATION_SECONDS', 0.5),

    /*
    |--------------------------------------------------------------------------
    | Gallery Media Expiration
    |--------------------------------------------------------------------------
    |
    | Number of hours a customer gallery and its underlying captured media
    | remain available after being generated before they are eligible for
    | cleanup.
    |
    */

    'gallery_expiration_hours' => env('PHOTOBOOTH_GALLERY_EXPIRATION_HOURS', 168),

];
