<?php

namespace App\Enums;

enum PaymentStatus: string
{
    case Pending = 'pending';
    case Success = 'success';
    case Failed = 'failed';
    case Cancelled = 'cancelled';

    /**
     * Map a Maya webhook status string to its corresponding domain payment status.
     *
     * Returns null when the status is not one Maya is known to report.
     *
     * @return self::Success|self::Failed|self::Cancelled|null
     */
    public static function fromMayaStatus(string $status): ?self
    {
        return match ($status) {
            'PAYMENT_SUCCESS' => self::Success,
            'PAYMENT_FAILED' => self::Failed,
            'PAYMENT_CANCELLED', 'PAYMENT_EXPIRED' => self::Cancelled,
            default => null,
        };
    }
}
