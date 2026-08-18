<?php

namespace App\Enums;

enum PhotoboothSessionStatus: string
{
    case New = 'new';
    case PaymentPending = 'payment_pending';
    case Paid = 'paid';
    case TemplateSelected = 'template_selected';
    case Capturing = 'capturing';
    case Customizing = 'customizing';
    case Processing = 'processing';
    case Printing = 'printing';
    case Completed = 'completed';
    case Expired = 'expired';
    case Abandoned = 'abandoned';

    /**
     * Get the next status in the standard photobooth session lifecycle.
     */
    public function next(): ?self
    {
        return match ($this) {
            self::New => self::PaymentPending,
            self::PaymentPending => self::Paid,
            self::Paid => self::TemplateSelected,
            self::TemplateSelected => self::Capturing,
            self::Capturing => self::Customizing,
            self::Customizing => self::Processing,
            self::Processing => self::Printing,
            self::Printing => self::Completed,
            default => null,
        };
    }

    /**
     * Determine whether this status is a terminal state that cannot transition further.
     */
    public function isTerminal(): bool
    {
        return in_array($this, [self::Completed, self::Expired, self::Abandoned], true);
    }

    /**
     * Determine whether a session may move from this status to the given status.
     */
    public function canTransitionTo(self $status): bool
    {
        if ($this->isTerminal()) {
            return false;
        }

        if (in_array($status, [self::Expired, self::Abandoned], true)) {
            return true;
        }

        return $this->next() === $status;
    }
}
