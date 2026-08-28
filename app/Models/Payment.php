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
 * @property int|null $paymongo_account_id
 * @property PaymentMethod $method
 * @property PaymentStatus $status
 * @property string|null $maya_payment_id
 * @property string|null $maya_checkout_id
 * @property string|null $paymongo_payment_intent_id
 * @property string|null $paymongo_payment_method_id
 * @property string|null $paymongo_payment_id
 * @property string|null $provider_idempotency_key
 * @property string|null $provider_status
 * @property string $amount
 * @property string|null $currency
 * @property Carbon|null $provider_expires_at
 * @property Carbon|null $paid_at
 * @property Carbon|null $failed_at
 * @property Carbon|null $cancelled_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable([
    'photobooth_session_id',
    'paymongo_account_id',
    'method',
    'status',
    'maya_payment_id',
    'maya_checkout_id',
    'paymongo_payment_intent_id',
    'paymongo_payment_method_id',
    'paymongo_payment_id',
    'provider_idempotency_key',
    'provider_status',
    'amount',
    'currency',
    'provider_expires_at',
    'paid_at',
    'failed_at',
    'cancelled_at',
])]
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
            'provider_expires_at' => 'datetime',
            'paid_at' => 'datetime',
            'failed_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    /**
     * Get the photobooth session that owns this payment attempt.
     *
     * @return BelongsTo<PhotoboothSession, $this>
     */
    public function photoboothSession(): BelongsTo
    {
        return $this->belongsTo(PhotoboothSession::class);
    }

    /**
     * Get the immutable tenant PayMongo credential version used by this attempt.
     *
     * @return BelongsTo<PayMongoAccount, $this>
     */
    public function payMongoAccount(): BelongsTo
    {
        return $this->belongsTo(PayMongoAccount::class);
    }
}
