<?php

use App\Enums\PhotoboothSessionStatus;
use App\Exceptions\InvalidPhotoboothSessionTransitionException;
use App\Models\PhotoboothSession;

test('transitionTo rejects an invalid transition without touching the database', function () {
    $session = new PhotoboothSession(['status' => PhotoboothSessionStatus::New]);

    expect(fn () => $session->transitionTo(PhotoboothSessionStatus::Capturing))
        ->toThrow(InvalidPhotoboothSessionTransitionException::class);

    expect($session->status)->toBe(PhotoboothSessionStatus::New);
});

test('transitionTo rejects transitioning out of a terminal status without touching the database', function () {
    $session = new PhotoboothSession(['status' => PhotoboothSessionStatus::Completed]);

    expect(fn () => $session->transitionTo(PhotoboothSessionStatus::New))
        ->toThrow(InvalidPhotoboothSessionTransitionException::class);
});

test('the transition exception message names the rejected from and to statuses', function () {
    $exception = new InvalidPhotoboothSessionTransitionException(
        PhotoboothSessionStatus::New,
        PhotoboothSessionStatus::Capturing,
    );

    expect($exception->getMessage())
        ->toContain(PhotoboothSessionStatus::New->value)
        ->toContain(PhotoboothSessionStatus::Capturing->value);
});
