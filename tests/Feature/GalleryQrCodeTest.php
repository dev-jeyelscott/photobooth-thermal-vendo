<?php

use App\Models\CapturedMedia;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;

test('the gallery qr code encodes the public gallery url for the session token', function () {
    $capturedMedia = CapturedMedia::factory()->create();

    $response = $this->get(route('gallery.qr-code', $capturedMedia->public_token));

    $response->assertOk();
    $response->assertHeader('content-type', 'image/svg+xml');

    $expectedUrl = route('gallery.show', $capturedMedia->public_token);

    $writer = new Writer(
        new ImageRenderer(
            new RendererStyle(320, 2),
            new SvgImageBackEnd,
        ),
    );

    expect($response->getContent())->toBe($writer->writeString($expectedUrl));
});

test('an unknown gallery token returns not found for the qr code endpoint', function () {
    $response = $this->get(route('gallery.qr-code', 'unknown-token'));

    $response->assertNotFound();
});
