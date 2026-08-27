<?php

use App\Enums\PhotoboothSessionStatus;

test('a session may follow each step of the standard lifecycle in order', function (PhotoboothSessionStatus $from, PhotoboothSessionStatus $to) {
    expect($from->canTransitionTo($to))->toBeTrue();
})->with([
    [PhotoboothSessionStatus::New, PhotoboothSessionStatus::PaymentPending],
    [PhotoboothSessionStatus::PaymentPending, PhotoboothSessionStatus::Paid],
    [PhotoboothSessionStatus::Paid, PhotoboothSessionStatus::TemplateSelected],
    [PhotoboothSessionStatus::TemplateSelected, PhotoboothSessionStatus::Capturing],
    [PhotoboothSessionStatus::Capturing, PhotoboothSessionStatus::Customizing],
    [PhotoboothSessionStatus::Customizing, PhotoboothSessionStatus::Processing],
    [PhotoboothSessionStatus::Processing, PhotoboothSessionStatus::Printing],
    [PhotoboothSessionStatus::Printing, PhotoboothSessionStatus::Completed],
]);

test('voucher redemption unlocks a session directly from New to Paid, bypassing payment pending', function () {
    expect(PhotoboothSessionStatus::New->canTransitionTo(PhotoboothSessionStatus::Paid))->toBeTrue();
});

test('a session may be expired or abandoned from any non-terminal status', function (PhotoboothSessionStatus $from) {
    expect($from->canTransitionTo(PhotoboothSessionStatus::Expired))->toBeTrue()
        ->and($from->canTransitionTo(PhotoboothSessionStatus::Abandoned))->toBeTrue();
})->with([
    PhotoboothSessionStatus::New,
    PhotoboothSessionStatus::PaymentPending,
    PhotoboothSessionStatus::Paid,
    PhotoboothSessionStatus::Capturing,
    PhotoboothSessionStatus::Printing,
]);

test('a session rejects transitions that skip a lifecycle step', function () {
    expect(PhotoboothSessionStatus::New->canTransitionTo(PhotoboothSessionStatus::Capturing))->toBeFalse()
        ->and(PhotoboothSessionStatus::PaymentPending->canTransitionTo(PhotoboothSessionStatus::Completed))->toBeFalse();
});

test('a session rejects transitioning backwards through the lifecycle', function () {
    expect(PhotoboothSessionStatus::Paid->canTransitionTo(PhotoboothSessionStatus::New))->toBeFalse()
        ->and(PhotoboothSessionStatus::Printing->canTransitionTo(PhotoboothSessionStatus::Capturing))->toBeFalse();
});

test('a terminal status rejects every transition', function (PhotoboothSessionStatus $terminal) {
    foreach (PhotoboothSessionStatus::cases() as $target) {
        expect($terminal->canTransitionTo($target))->toBeFalse();
    }
})->with([
    PhotoboothSessionStatus::Completed,
    PhotoboothSessionStatus::Expired,
    PhotoboothSessionStatus::Abandoned,
]);

test('isTerminal reports true only for completed, expired, and abandoned statuses', function () {
    foreach (PhotoboothSessionStatus::cases() as $status) {
        $expected = in_array($status, [
            PhotoboothSessionStatus::Completed,
            PhotoboothSessionStatus::Expired,
            PhotoboothSessionStatus::Abandoned,
        ], true);

        expect($status->isTerminal())->toBe($expected);
    }
});

test('next returns the following lifecycle status or null when there is none', function () {
    expect(PhotoboothSessionStatus::New->next())->toBe(PhotoboothSessionStatus::PaymentPending)
        ->and(PhotoboothSessionStatus::Printing->next())->toBe(PhotoboothSessionStatus::Completed)
        ->and(PhotoboothSessionStatus::Completed->next())->toBeNull()
        ->and(PhotoboothSessionStatus::Abandoned->next())->toBeNull();
});
