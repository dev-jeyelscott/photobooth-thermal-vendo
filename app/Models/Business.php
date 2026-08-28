<?php

namespace App\Models;

use App\Enums\PayMongoMode;
use Database\Factories\BusinessFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $name
 * @property string $slug
 * @property int $owner_user_id
 * @property PayMongoMode $active_paymongo_mode
 * @property int|null $test_paymongo_account_id
 * @property int|null $live_paymongo_account_id
 */
#[Fillable([
    'name',
    'slug',
    'owner_user_id',
])]
class Business extends Model
{
    /** @use HasFactory<BusinessFactory> */
    use HasFactory;

    /**
     * Use the stable public slug for implicit route-model binding.
     */
    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * Get the user who explicitly owns this Business.
     *
     * @return BelongsTo<User, $this>
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    /**
     * Get users assigned to this Business.
     *
     * @return HasMany<User, $this>
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * Get customer sessions owned by this Business.
     *
     * @return HasMany<PhotoboothSession, $this>
     */
    public function photoboothSessions(): HasMany
    {
        return $this->hasMany(PhotoboothSession::class);
    }

    /**
     * Get all historical PayMongo credential versions owned by this Business.
     *
     * @return HasMany<PayMongoAccount, $this>
     */
    public function payMongoAccounts(): HasMany
    {
        return $this->hasMany(PayMongoAccount::class);
    }

    /**
     * Get the currently selected Test credential version.
     *
     * @return BelongsTo<PayMongoAccount, $this>
     */
    public function testPayMongoAccount(): BelongsTo
    {
        return $this->belongsTo(
            PayMongoAccount::class,
            'test_paymongo_account_id',
        );
    }

    /**
     * Get the currently selected Live credential version.
     *
     * @return BelongsTo<PayMongoAccount, $this>
     */
    public function livePayMongoAccount(): BelongsTo
    {
        return $this->belongsTo(
            PayMongoAccount::class,
            'live_paymongo_account_id',
        );
    }

    /**
     * Cast the active payment mode to its explicit domain enum.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'active_paymongo_mode' => PayMongoMode::class,
        ];
    }
}
