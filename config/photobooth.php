<?php

use App\Services\Printing\LocalMockPrinterDriver;
use App\Services\Printing\PrintBridgePrinterDriver;

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
    | Payment Timeout
    |--------------------------------------------------------------------------
    |
    | Number of seconds the kiosk waits for a Maya QR payment to complete
    | before surfacing a payment-timeout error to the customer.
    |
    */

    'payment_timeout_seconds' => env('PHOTOBOOTH_PAYMENT_TIMEOUT_SECONDS', 120),

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
    | Capture Countdown Seconds
    |--------------------------------------------------------------------------
    |
    | Number of seconds the kiosk counts down before each shot is captured
    | during the capture step.
    |
    */

    'capture_countdown_seconds' => env('PHOTOBOOTH_CAPTURE_COUNTDOWN_SECONDS', 3),

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

    /*
    |--------------------------------------------------------------------------
    | Default Printer Driver
    |--------------------------------------------------------------------------
    |
    | The printer driver used to dispatch print jobs to a thermal printer.
    | Keys map to fully-qualified App\Services\Printing driver classes,
    | allowing a future network or print-bridge driver to be substituted
    | without changing application code.
    |
    */

    'default_printer_driver' => env('PHOTOBOOTH_DEFAULT_PRINTER_DRIVER', 'local_mock'),

    'printer_drivers' => [
        'local_mock' => LocalMockPrinterDriver::class,
        'print_bridge' => PrintBridgePrinterDriver::class,
    ],

    /*
    |--------------------------------------------------------------------------
    | Print Bridge Transport
    |--------------------------------------------------------------------------
    |
    | Connection details for the HTTP print-bridge service that forwards
    | rendered receipt images to physical thermal printer hardware, used
    | when 'print_bridge' is the selected printer driver.
    |
    */

    'print_bridge' => [
        'endpoint' => env('PHOTOBOOTH_PRINT_BRIDGE_ENDPOINT'),
        'timeout_seconds' => env('PHOTOBOOTH_PRINT_BRIDGE_TIMEOUT_SECONDS', 10),
        'auth_token' => env('PHOTOBOOTH_PRINT_BRIDGE_AUTH_TOKEN'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Receipt Print Width
    |--------------------------------------------------------------------------
    |
    | Target width, in pixels, that rendered receipt output is scaled to
    | before thresholding. Common thermal printer widths are 384px (58mm
    | paper) and 576px (80mm paper).
    |
    */

    'receipt_printer_width_px' => env('PHOTOBOOTH_RECEIPT_PRINTER_WIDTH_PX', 384),

    /*
    |--------------------------------------------------------------------------
    | Receipt Threshold
    |--------------------------------------------------------------------------
    |
    | Luminance value (0-255) above which a pixel is rendered pure white and
    | below which it is rendered pure black, matching the binary tonal range
    | thermal printer heads can reproduce.
    |
    */

    'receipt_threshold' => env('PHOTOBOOTH_RECEIPT_THRESHOLD', 128),

    /*
    |--------------------------------------------------------------------------
    | Receipt Include Session Info
    |--------------------------------------------------------------------------
    |
    | Whether the rendered receipt output appends a footer with the session
    | reference and date, giving the customer a printed lookup reference.
    |
    */

    'receipt_include_session_info' => env('PHOTOBOOTH_RECEIPT_INCLUDE_SESSION_INFO', true),

    /*
    |--------------------------------------------------------------------------
    | Session Price
    |--------------------------------------------------------------------------
    |
    | The default price, in PHP, charged for a single photobooth session
    | when no ApplicationSetting override has been configured by an admin.
    |
    */

    'session_price' => env('PHOTOBOOTH_SESSION_PRICE', 20.00),

    /*
    |--------------------------------------------------------------------------
    | Retake Limit
    |--------------------------------------------------------------------------
    |
    | Default number of retakes a customer may take per shot, used when no
    | ApplicationSetting override has been configured by an admin.
    |
    */

    'retake_limit' => env('PHOTOBOOTH_RETAKE_LIMIT', 2),

    /*
    |--------------------------------------------------------------------------
    | Session Timeout
    |--------------------------------------------------------------------------
    |
    | Default number of seconds a photobooth session remains valid before it
    | is automatically expired, used when no ApplicationSetting override has
    | been configured by an admin.
    |
    */

    'session_timeout_seconds' => env('PHOTOBOOTH_SESSION_TIMEOUT_SECONDS', 900),

    /*
    |--------------------------------------------------------------------------
    | GIF Frame Duration (Milliseconds)
    |--------------------------------------------------------------------------
    |
    | Default number of milliseconds each captured photo is displayed for in
    | the animated GIF, used when no ApplicationSetting override has been
    | configured by an admin.
    |
    */

    'gif_frame_duration_ms' => env('PHOTOBOOTH_GIF_FRAME_DURATION_MS', 500),

    /*
    |--------------------------------------------------------------------------
    | Default Printer
    |--------------------------------------------------------------------------
    |
    | The default thermal printer used when no ApplicationSetting override
    | has been configured by an admin.
    |
    */

    'default_printer' => env('PHOTOBOOTH_DEFAULT_PRINTER', 'local_mock'),

    /*
    |--------------------------------------------------------------------------
    | Booth Display Name
    |--------------------------------------------------------------------------
    |
    | The default name shown on the kiosk and receipts to identify this
    | photobooth, used when no ApplicationSetting override has been
    | configured by an admin.
    |
    */

    'booth_display_name' => env('PHOTOBOOTH_BOOTH_DISPLAY_NAME', 'Photobooth'),

    /*
    |--------------------------------------------------------------------------
    | Rate Limits
    |--------------------------------------------------------------------------
    |
    | Per-minute request thresholds, keyed by client IP, applied via the
    | `throttle` middleware to public-facing endpoints prone to abuse.
    |
    */

    'rate_limits' => [
        'session_creation_attempts_per_minute' => env('PHOTOBOOTH_SESSION_CREATION_RATE_LIMIT_PER_MINUTE', 20),
        'payment_attempts_per_minute' => env('PHOTOBOOTH_PAYMENT_RATE_LIMIT_PER_MINUTE', 10),
        'voucher_attempts_per_minute' => env('PHOTOBOOTH_VOUCHER_RATE_LIMIT_PER_MINUTE', 10),
    ],

    /*
    |--------------------------------------------------------------------------
    | Captured Photo Max Size
    |--------------------------------------------------------------------------
    |
    | Maximum size, in kilobytes, allowed for each base64-encoded photo
    | submitted when composing a session's final color output.
    |
    */

    'captured_photo_max_kilobytes' => env('PHOTOBOOTH_CAPTURED_PHOTO_MAX_KILOBYTES', 8192),

    /*
    |--------------------------------------------------------------------------
    | Captured Frame Max Dimension
    |--------------------------------------------------------------------------
    |
    | Maximum width or height, in pixels, allowed for a stored source frame
    | uploaded from the capture step. Frames exceeding this on either side
    | are downscaled (preserving aspect ratio) before being persisted.
    |
    */

    'captured_frame_max_dimension_px' => env('PHOTOBOOTH_CAPTURED_FRAME_MAX_DIMENSION_PX', 2400),

    /*
    |--------------------------------------------------------------------------
    | Currency
    |--------------------------------------------------------------------------
    |
    | The ISO 4217 currency code used when displaying prices on the kiosk,
    | receipts, and admin screens, used when no ApplicationSetting override
    | has been configured by an admin.
    |
    */

    'currency' => env('PHOTOBOOTH_CURRENCY', 'PHP'),

    /*
    |--------------------------------------------------------------------------
    | Capture Countdown
    |--------------------------------------------------------------------------
    |
    | Number of seconds the kiosk counts down before each shot is captured,
    | used when no ApplicationSetting override has been configured by an
    | admin.
    |
    */

    'countdown_seconds' => env('PHOTOBOOTH_COUNTDOWN_SECONDS', 3),

    /*
    |--------------------------------------------------------------------------
    | Receipt Header
    |--------------------------------------------------------------------------
    |
    | Text printed at the top of the customer receipt, used when no
    | ApplicationSetting override has been configured by an admin.
    |
    */

    'receipt_header' => env('PHOTOBOOTH_RECEIPT_HEADER', 'Thank you for visiting!'),

    /*
    |--------------------------------------------------------------------------
    | Receipt Footer
    |--------------------------------------------------------------------------
    |
    | Text printed at the bottom of the customer receipt, used when no
    | ApplicationSetting override has been configured by an admin.
    |
    */

    'receipt_footer' => env('PHOTOBOOTH_RECEIPT_FOOTER', 'See you again soon!'),

    /*
    |--------------------------------------------------------------------------
    | Maintenance Mode
    |--------------------------------------------------------------------------
    |
    | Whether the kiosk displays a maintenance message instead of accepting
    | new sessions, used when no ApplicationSetting override has been
    | configured by an admin.
    |
    */

    'maintenance_mode' => env('PHOTOBOOTH_MAINTENANCE_MODE', false),

    /*
    |--------------------------------------------------------------------------
    | Maintenance Message
    |--------------------------------------------------------------------------
    |
    | Message shown on the kiosk when maintenance mode is enabled, used when
    | no ApplicationSetting override has been configured by an admin.
    |
    */

    'maintenance_message' => env('PHOTOBOOTH_MAINTENANCE_MESSAGE', ''),

];
