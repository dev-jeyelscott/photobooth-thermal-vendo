<?php

namespace App\Exceptions;

use RuntimeException;

class PayMongoProviderException extends RuntimeException
{
    /**
     * Create a provider exception without retaining sensitive response content.
     */
    private function __construct(
        public readonly bool $outcomeUncertain,
    ) {
        parent::__construct('PayMongo QR Ph payment creation failed.');
    }

    /**
     * Create an exception for a definitive provider rejection such as a 4xx response.
     */
    public static function definitive(): self
    {
        return new self(false);
    }

    /**
     * Create an exception for a network, 5xx, or malformed-success outcome.
     */
    public static function uncertain(): self
    {
        return new self(true);
    }
}
