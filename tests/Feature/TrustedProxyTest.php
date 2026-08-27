<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

it('honors forwarded scheme host and client ip from the trusted proxy boundary', function () {
    Route::get('/testing/trusted-proxy', function (Request $request) {
        return response()->json([
            'secure' => $request->secure(),
            'host' => $request->getHost(),
            'ip' => $request->ip(),
        ]);
    });

    $response = $this
        ->withServerVariables([
            'REMOTE_ADDR' => '172.20.0.10',
            'HTTP_X_FORWARDED_FOR' => '203.0.113.25',
            'HTTP_X_FORWARDED_PROTO' => 'https',
            'HTTP_X_FORWARDED_HOST' => 'thermasnap.example.com',
            'HTTP_X_FORWARDED_PORT' => '443',
        ])
        ->get('/testing/trusted-proxy');

    $response
        ->assertOk()
        ->assertJson([
            'secure' => true,
            'host' => 'thermasnap.example.com',
            'ip' => '203.0.113.25',
        ]);
});
