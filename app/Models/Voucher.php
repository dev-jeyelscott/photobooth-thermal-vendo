<?php

namespace App\Models;

use Database\Factories\VoucherFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $code
 * @property bool $active
 * @property Carbon|null $valid_from
 * @property Carbon|null $expires_at
 * @property int $usage_limit
 * @property int $usage_count
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['code', 'active', 'valid_from', 'expires_at', 'usage_limit', 'usage_count'])]
class Voucher extends Model
{
    /** @use HasFactory<VoucherFactory> */
    use HasFactory;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'valid_from' => 'datetime',
            'expires_at' => 'datetime',
            'usage_limit' => 'integer',
            'usage_count' => 'integer',
        ];
    }

    /**
     * @return HasMany<PhotoboothSession, $this>
     */
    public function photoboothSessions(): HasMany
    {
        return $this->hasMany(PhotoboothSession::class);
    }
}
