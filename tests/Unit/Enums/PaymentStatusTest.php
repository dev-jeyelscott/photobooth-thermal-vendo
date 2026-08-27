<?php

use App\Enums\PaymentStatus;

test('fromMayaStatus maps each recognized Maya status to its domain payment status', function (string $mayaStatus, PaymentStatus $expected) {
    expect(PaymentStatus::fromMayaStatus($mayaStatus))->toBe($expected);
})->with([
    ['PAYMENT_SUCCESS', PaymentStatus::Success],
    ['PAYMENT_FAILED', PaymentStatus::Failed],
    ['PAYMENT_CANCELLED', PaymentStatus::Cancelled],
    ['PAYMENT_EXPIRED', PaymentStatus::Cancelled],
]);

test('fromMayaStatus returns null for an unrecognized or empty status', function (string $mayaStatus) {
    expect(PaymentStatus::fromMayaStatus($mayaStatus))->toBeNull();
})->with([
    'PAYMENT_PENDING',
    'payment_success',
    '',
    'not-a-real-status',
]);
