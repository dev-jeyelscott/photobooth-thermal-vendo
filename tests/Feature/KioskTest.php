<?php

use App\Enums\PhotoboothSessionStatus;
use App\Models\ApplicationSetting;
use App\Models\PhotoboothSession;
use App\Models\Voucher;

test('the kiosk start screen renders with its primary actions', function () {
    $response = $this->get(route('kiosk'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('kiosk')
        ->has('idleTimeoutSeconds')
        ->has('captureShotCount')
        ->has('captureRetakeLimit')
        ->has('captureCountdownSeconds')
    );
});

test('the kiosk exposes an admin-configured capture countdown instead of the config default', function () {
    ApplicationSetting::updateOrCreate(
        ['key' => 'capture_countdown_seconds'],
        ['value' => '7']
    );

    $response = $this->get(route('kiosk'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->where('captureCountdownSeconds', 7)
    );
});

test('the kiosk UI adapts across responsive breakpoints without device-specific assumptions', function () {
    $kiosk = file_get_contents(resource_path('js/pages/kiosk.tsx'));
    $kioskShell = file_get_contents(resource_path('js/components/kiosk-shell.tsx'));

    // Small, medium, large, and landscape-responsive treatments must remain
    // represented without relying on device or platform sniffing.
    expect($kiosk)->toContain('sm:')
        ->and($kiosk)->toContain('lg:')
        ->and($kiosk)->toContain('landscape:')
        ->and($kiosk)->not->toContain('iPad')
        ->and($kiosk)->not->toContain('navigator.platform')
        ->and($kiosk)->not->toContain('MSStream');

    // The shared kiosk shell owns the fullscreen viewport boundary after the
    // redesign extracted common branding, progress, and page framing.
    expect($kiosk)->toContain('<KioskShell')
        ->and($kioskShell)->toContain('min-h-dvh')
        ->and($kioskShell)->not->toContain('min-h-screen');
});

test('the idle timer responds to both touch and mouse activity', function () {
    $idleTimer = file_get_contents(resource_path('js/hooks/use-idle-timer.ts'));

    expect($idleTimer)->toContain("'pointerdown'")
        ->and($idleTimer)->toContain("'touchstart'")
        ->and($idleTimer)->toContain("'keydown'")
        ->and($idleTimer)->toContain("'wheel'")
        ->and($idleTimer)->not->toContain('ontouchstart');
});

test('an invalid voucher redemption returns a customer-safe, sanitized error without mutating the session', function () {
    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::New]);

    $response = $this->postJson(route('kiosk.sessions.voucher.store', $session->session_token), [
        'code' => 'DOES-NOT-EXIST',
    ]);

    $response->assertStatus(422);
    $response->assertJson([
        'message' => 'This voucher code is invalid or can no longer be used.',
        'status' => PhotoboothSessionStatus::New->value,
    ]);

    expect($session->fresh()->status)->toBe(PhotoboothSessionStatus::New);
});

test('redeeming a valid voucher against an expired session reports the expired status instead of unlocking it', function () {
    $voucher = Voucher::factory()->create(['usage_limit' => 1, 'usage_count' => 0]);
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::New,
        'expires_at' => now()->subMinute(),
    ]);

    $response = $this->postJson(route('kiosk.sessions.voucher.store', $session->session_token), [
        'code' => $voucher->code,
    ]);

    $response->assertStatus(422);
    $response->assertJson(['status' => PhotoboothSessionStatus::Expired->value]);

    expect($session->fresh()->status)->toBe(PhotoboothSessionStatus::Expired)
        ->and($voucher->fresh()->usage_count)->toBe(0);
});

test('resuming an expired session is sanitized and reports no active session', function () {
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::TemplateSelected,
        'expires_at' => now()->subMinute(),
    ]);

    $response = $this->getJson(route('kiosk.sessions.show', $session->session_token));

    $response->assertStatus(410);
    $response->assertExactJson(['message' => 'Session is no longer active.']);

    expect($session->fresh()->status)->toBe(PhotoboothSessionStatus::Expired);
});

test('an active session exposes payment and print job status alongside the session status', function () {
    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::New]);

    $response = $this->getJson(route('kiosk.sessions.show', $session->session_token));

    $response->assertOk();
    $response->assertJsonStructure([
        'sessionToken',
        'status',
        'startedAt',
        'expiresAt',
        'paymentStatus',
        'printJobStatus',
    ]);
    $response->assertJson([
        'paymentStatus' => null,
        'printJobStatus' => null,
    ]);
});

test('the kiosk wires a shared error-state component for every required failure scenario', function () {
    $kiosk = file_get_contents(resource_path('js/pages/kiosk.tsx'));
    $errorState = file_get_contents(resource_path('js/components/kiosk-error-state.tsx'));

    expect($kiosk)->toContain('KioskErrorState')
        ->and($kiosk)->toContain("raiseKioskError('expired-session')")
        ->and($kiosk)->toContain("raiseKioskError('invalid-voucher'")
        ->and($kiosk)->toContain("raiseKioskError('payment-failed'")
        ->and($kiosk)->toContain("raiseKioskError('payment-timeout'")
        ->and($kiosk)->toContain("raiseKioskError('processing-failure'")
        ->and($kiosk)->toContain('kind="print-failure"')
        ->and($kiosk)->toContain("raiseKioskError('network-interruption'");

    foreach ([
        'no-camera-permission',
        'camera-unavailable',
        'payment-timeout',
        'payment-failed',
        'invalid-voucher',
        'processing-failure',
        'print-failure',
        'network-interruption',
        'expired-session',
    ] as $kind) {
        expect($errorState)->toContain("'{$kind}'");
    }
});

test('a kiosk error state blocks progression by replacing the active step instead of layering over it', function () {
    $kiosk = file_get_contents(resource_path('js/pages/kiosk.tsx'));

    expect($kiosk)->toContain('showKioskError')
        ->and($kiosk)->toContain('!showKioskError &&');
});

test('the template, sticker, and preview steps surface the shared error state for an expired session or network interruption', function () {
    $kiosk = file_get_contents(resource_path('js/pages/kiosk.tsx'));
    $templateStep = file_get_contents(resource_path('js/components/template-selection-step.tsx'));
    $stickerStep = file_get_contents(resource_path('js/components/sticker-selection-step.tsx'));
    $previewStep = file_get_contents(resource_path('js/components/preview-step.tsx'));

    expect($kiosk)->toContain('<TemplateSelectionStep')
        ->and($kiosk)->toContain('<StickerSelectionStep')
        ->and($kiosk)->toContain('<PreviewStep')
        ->and(substr_count($kiosk, 'onExpired={() =>'))->toBeGreaterThanOrEqual(3);

    foreach ([$templateStep, $stickerStep, $previewStep] as $step) {
        expect($step)->toContain('KioskErrorState')
            ->and($step)->toContain('result.expired')
            ->and($step)->toContain('onExpired')
            ->and($step)->toContain('kind="network-interruption"');
    }
});
