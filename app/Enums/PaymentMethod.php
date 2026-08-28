<?php

namespace App\Enums;

enum PaymentMethod: string
{
    /**
     * Legacy Maya rows remain readable until the dedicated provider cleanup slice.
     */
    case Maya = 'maya';

    case PayMongoQrPh = 'paymongo_qrph';
    case Voucher = 'voucher';

    /**
     * Get the customer-facing label for this payment method.
     */
    public function label(): string
    {
        return match ($this) {
            self::Maya => 'Maya',
            self::PayMongoQrPh => 'PayMongo QR Ph',
            self::Voucher => 'Voucher',
        };
    }
}
