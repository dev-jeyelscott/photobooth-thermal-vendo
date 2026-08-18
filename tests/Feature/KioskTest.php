<?php

test('the kiosk start screen renders with its primary actions', function () {
    $response = $this->get(route('kiosk'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('kiosk')
        ->has('idleTimeoutSeconds')
    );
});

test('the kiosk UI adapts across responsive breakpoints without device-specific assumptions', function () {
    $kiosk = file_get_contents(resource_path('js/pages/kiosk.tsx'));

    // Small (phone), medium (sm) and large (lg) breakpoints must all be represented
    // so the layout scales across kiosk touchscreens, tablets, and phones.
    expect($kiosk)->toContain('sm:')
        ->and($kiosk)->toContain('lg:')
        ->and($kiosk)->toContain('landscape:')
        ->and($kiosk)->not->toContain('iPad')
        ->and($kiosk)->not->toContain('navigator.platform')
        ->and($kiosk)->not->toContain('MSStream');

    // Fullscreen-friendly: rely on the dynamic viewport height unit rather than
    // 100vh, which does not account for mobile browser chrome.
    expect($kiosk)->toContain('min-h-dvh')
        ->and($kiosk)->not->toContain('min-h-screen');
});

test('the idle timer responds to both touch and mouse activity', function () {
    $idleTimer = file_get_contents(resource_path('js/hooks/use-idle-timer.ts'));

    expect($idleTimer)->toContain("'pointerdown'")
        ->and($idleTimer)->toContain("'touchstart'")
        ->and($idleTimer)->toContain("'keydown'")
        ->and($idleTimer)->toContain("'wheel'")
        ->and($idleTimer)->not->toContain('ontouchstart');
});
