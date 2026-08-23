<?php

use App\Models\User;
use App\Models\Voucher;
use Illuminate\Support\Carbon;

test('voucher index exposes authoritative server time for availability presentation', function () {
    Carbon::setTestNow(Carbon::parse('2026-08-23 13:17:00'));

    try {
        $user = User::factory()->create();

        Voucher::factory()->create([
            'code' => 'TIME-BOUNDARY',
        ]);

        $expectedServerNow = now()->toIso8601String();

        $response = $this
            ->actingAs($user)
            ->get(route('admin.vouchers.index'));

        $response->assertOk();

        $response->assertInertia(fn ($page) => $page
            ->component('admin/vouchers/index')
            ->where('serverNow', $expectedServerNow)
            ->has('vouchers', 1)
            ->where('vouchers.0.code', 'TIME-BOUNDARY')
        );
    } finally {
        Carbon::setTestNow();
    }
});
