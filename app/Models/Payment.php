<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use Database\Factories\PaymentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $photobooth_session_id
 * @property PaymentMethod $method
 * @property PaymentStatus $status
 * @property string|null $maya_payment_id
 * @property string|null $maya_checkout_id
 * @property string $amount
 * @property Carbon|null $paid_at
 * @property Carbon|null $failed_at
 * @property Carbon|null $cancelled_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['photobooth_session_id', 'method', 'status', 'maya_payment_id', 'maya_checkout_id', 'amount', 'paid_at', 'failed_at', 'cancelled_at'])]
class Payment extends Model
{
    /** @use HasFactory<PaymentFactory> */
    use HasFactory;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'method' => PaymentMethod::class,
            'status' => PaymentStatus::class,
            'amount' => 'decimal:2',
            'paid_at' => 'datetime',
            'failed_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<PhotoboothSession, $this>
     */
    public function photoboothSession(): BelongsTo
    {
        return $this->belongsTo(PhotoboothSession::class);
    }
}
