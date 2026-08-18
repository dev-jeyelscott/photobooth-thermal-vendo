<?php

namespace App\Exceptions;

use App\Enums\PhotoboothSessionStatus;
use RuntimeException;

class InvalidPhotoboothSessionTransitionException extends RuntimeException
{
    public function __construct(PhotoboothSessionStatus $from, PhotoboothSessionStatus $to)
    {
        parent::__construct("Cannot transition photobooth session from [{$from->value}] to [{$to->value}].");
    }
}
