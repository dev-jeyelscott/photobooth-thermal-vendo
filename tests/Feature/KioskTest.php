<?php

test('the kiosk start screen renders with its primary actions', function () {
    $response = $this->get(route('kiosk'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('kiosk')
        ->has('idleTimeoutSeconds')
    );
});
