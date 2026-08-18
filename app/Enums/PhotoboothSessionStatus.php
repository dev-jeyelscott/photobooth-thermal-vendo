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
}
