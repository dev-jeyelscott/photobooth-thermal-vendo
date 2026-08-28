<?php

namespace App\Enums;

enum PayMongoMode: string
{
    case Test = 'test';
    case Live = 'live';

    /**
     * Get the required PayMongo public-key prefix for this mode.
     */
    public function publicKeyPrefix(): string
    {
        return match ($this) {
            self::Test => 'pk_test_',
            self::Live => 'pk_live_',
        };
    }

    /**
     * Get the required PayMongo secret-key prefix for this mode.
     */
    public function secretKeyPrefix(): string
    {
        return match ($this) {
            self::Test => 'sk_test_',
            self::Live => 'sk_live_',
        };
    }

    /**
     * Get the Business foreign-key column that selects this mode's account.
     */
    public function businessPointerColumn(): string
    {
        return match ($this) {
            self::Test => 'test_paymongo_account_id',
            self::Live => 'live_paymongo_account_id',
        };
    }
}
