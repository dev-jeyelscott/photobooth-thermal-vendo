<?php

namespace App\Models;

use App\Enums\PayMongoMode;
use Database\Factories\PayMongoAccountFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string|null $public_id
 * @property int $business_id
 * @property PayMongoMode $mode
 * @property string $public_key
 * @property string $secret_key
 * @property string $public_key_last4
 * @property string $secret_key_last4
 * @property string|null $webhook_id
 * @property string|null $webhook_secret
 * @property string|null $webhook_status
 * @property Carbon|null $verified_at
 * @property Carbon|null $webhook_provisioned_at
 * @property Carbon|null $superseded_at
 * @property int|null $created_by_user_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable([
    'business_id',
    'mode',
    'public_key',
    'secret_key',
    'public_key_last4',
    'secret_key_last4',
    'webhook_id',
    'webhook_secret',
    'webhook_status',
    'verified_at',
    'webhook_provisioned_at',
    'superseded_at',
    'created_by_user_id',
])]
#[Hidden([
    'public_key',
    'secret_key',
    'webhook_secret',
])]
class PayMongoAccount extends Model
{
    /** @use HasFactory<PayMongoAccountFactory> */
    use HasFactory;

    /**
     * Use the canonical tenant PayMongo credential table defined by the
     * payment migration roadmap and schema.
     *
     * @var string
     */
    protected $table = 'paymongo_accounts';

    /**
     * Generate the non-secret public routing UUID before persistence.
     */
    protected static function booted(): void
    {
        static::creating(function (PayMongoAccount $account): void {
            if (
                ! is_string($account->public_id)
                || $account->public_id === ''
            ) {
                $account->public_id = (string) Str::uuid();
            }
        });
    }

    /**
     * Use the opaque UUID for public route-model binding.
     */
    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    /**
     * Determine whether this credential version may create new booth payments.
     */
    public function isReadyForPayments(): bool
    {
        return $this->verified_at !== null
            && is_string($this->webhook_id)
            && $this->webhook_id !== ''
            && is_string($this->webhook_secret)
            && $this->webhook_secret !== ''
            && $this->webhook_provisioned_at !== null
            && $this->webhook_status === 'enabled'
            && $this->superseded_at === null;
    }

    /**
     * Get the Business that owns this immutable credential version.
     *
     * @return BelongsTo<Business, $this>
     */
    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    /**
     * Get the user who created this credential version.
     *
     * @return BelongsTo<User, $this>
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    /**
     * Cast encrypted credential material and lifecycle timestamps.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'mode' => PayMongoMode::class,
            'public_key' => 'encrypted',
            'secret_key' => 'encrypted',
            'webhook_secret' => 'encrypted',
            'verified_at' => 'datetime',
            'webhook_provisioned_at' => 'datetime',
            'superseded_at' => 'datetime',
        ];
    }
}
