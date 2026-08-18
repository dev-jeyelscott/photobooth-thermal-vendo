<?php

namespace App\Enums;

enum PrintJobStatus: string
{
    case Pending = 'pending';
    case Printing = 'printing';
    case Printed = 'printed';
    case Failed = 'failed';
}
