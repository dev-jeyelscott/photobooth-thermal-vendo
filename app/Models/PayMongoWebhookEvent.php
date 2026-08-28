<?php

namespace App\Models;

use Database\Factories\PayMongoWebhookEventFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $paymongo_account_id
 * @property string $provider_event_id
 * @property string $event_type
 * @property bool $livemode
 * @property array<string, mixed> $payload
 * @property string $payload_sha256
 * @property Carbon $received_at
 * @property Carbon|null $processed_at
 * @property Carbon|null $failed_at
 * @property string|null $last_error
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable([
    'paymongo_account_id',
    'provider_event_id',
    'event_type',
    'livemode',
    'payload',
    'payload_sha256',
    'received_at',
    'processed_at',
    'failed_at',
    'last_error',
])]
#[Hidden([
    'payload',
])]
class PayMongoWebhookEvent extends Model
{
    /** @use HasFactory<PayMongoWebhookEventFactory> */
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'paymongo_webhook_events';

    /**
     * Get the immutable historical PayMongo credential version that authenticated this event.
     *
     * @return BelongsTo<PayMongoAccount, $this>
     */
    public function payMongoAccount(): BelongsTo
    {
        return $this->belongsTo(PayMongoAccount::class, 'paymongo_account_id');
    }

    /**
     * Cast encrypted webhook evidence and lifecycle timestamps.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'livemode' => 'boolean',
            'payload' => 'encrypted:array',
            'received_at' => 'datetime',
            'processed_at' => 'datetime',
            'failed_at' => 'datetime',
        ];
    }
}
