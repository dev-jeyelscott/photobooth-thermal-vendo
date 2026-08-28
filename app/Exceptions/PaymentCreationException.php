<?php

namespace App\Exceptions;

use RuntimeException;

class PaymentCreationException extends RuntimeException
{
    /**
     * Create a customer-safe payment creation exception with its HTTP status.
     */
    public function __construct(
        public readonly string $safeMessage,
        public readonly int $httpStatus,
    ) {
        parent::__construct($safeMessage);
    }
}
