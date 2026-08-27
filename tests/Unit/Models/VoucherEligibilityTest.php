<?php

use App\Models\Voucher;

function eligibleVoucher(array $overrides = []): Voucher
{
    return new Voucher(array_merge([
        'active' => true,
        'valid_from' => null,
        'expires_at' => now()->addMonth(),
        'usage_limit' => 1,
        'usage_count' => 0,
    ], $overrides));
}

test('a voucher with default active, unstarted-restriction, unexpired, and unused state is eligible', function () {
    expect(eligibleVoucher()->isEligible())->toBeTrue();
});

test('an inactive voucher is not eligible', function () {
    expect(eligibleVoucher(['active' => false])->isEligible())->toBeFalse();
});

test('a voucher with a future valid_from has not started and is not eligible', function () {
    $voucher = eligibleVoucher(['valid_from' => now()->addDay()]);

    expect($voucher->hasStarted())->toBeFalse()
        ->and($voucher->isEligible())->toBeFalse();
});

test('a voucher with a past valid_from has started', function () {
    $voucher = eligibleVoucher(['valid_from' => now()->subDay()]);

    expect($voucher->hasStarted())->toBeTrue()
        ->and($voucher->isEligible())->toBeTrue();
});

test('a voucher with a null valid_from has started', function () {
    expect(eligibleVoucher(['valid_from' => null])->hasStarted())->toBeTrue();
});

test('a voucher past its expiration timestamp has expired and is not eligible', function () {
    $voucher = eligibleVoucher(['expires_at' => now()->subMinute()]);

    expect($voucher->hasExpired())->toBeTrue()
        ->and($voucher->isEligible())->toBeFalse();
});

test('a voucher with a null expires_at never expires', function () {
    expect(eligibleVoucher(['expires_at' => null])->hasExpired())->toBeFalse();
});

test('a voucher at its usage limit has no remaining uses and is not eligible', function () {
    $voucher = eligibleVoucher(['usage_limit' => 1, 'usage_count' => 1]);

    expect($voucher->hasRemainingUses())->toBeFalse()
        ->and($voucher->isEligible())->toBeFalse();
});

test('a voucher under its usage limit has remaining uses', function () {
    $voucher = eligibleVoucher(['usage_limit' => 3, 'usage_count' => 2]);

    expect($voucher->hasRemainingUses())->toBeTrue()
        ->and($voucher->isEligible())->toBeTrue();
});
