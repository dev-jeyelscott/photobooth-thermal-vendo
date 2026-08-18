<?php

namespace App\Models;

use App\Enums\PhotoboothSessionStatus;
use Database\Factories\PhotoboothSessionFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $session_token
 * @property PhotoboothSessionStatus $status
 * @property int|null $photo_template_id
 * @property int|null $sticker_design_id
 * @property int|null $voucher_id
 * @property Carbon|null $started_at
 * @property Carbon|null $expires_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['session_token', 'status', 'photo_template_id', 'sticker_design_id', 'voucher_id', 'started_at', 'expires_at'])]
class PhotoboothSession extends Model
{
    /** @use HasFactory<PhotoboothSessionFactory> */
    use HasFactory;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => PhotoboothSessionStatus::class,
            'started_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<PhotoTemplate, $this>
     */
    public function photoTemplate(): BelongsTo
    {
        return $this->belongsTo(PhotoTemplate::class);
    }

    /**
     * @return BelongsTo<StickerDesign, $this>
     */
    public function stickerDesign(): BelongsTo
    {
        return $this->belongsTo(StickerDesign::class);
    }

    /**
     * @return BelongsTo<Voucher, $this>
     */
    public function voucher(): BelongsTo
    {
        return $this->belongsTo(Voucher::class);
    }

    /**
     * @return HasOne<Payment, $this>
     */
    public function payment(): HasOne
    {
        return $this->hasOne(Payment::class);
    }

    /**
     * @return HasMany<CapturedMedia, $this>
     */
    public function capturedMedia(): HasMany
    {
        return $this->hasMany(CapturedMedia::class);
    }

    /**
     * @return HasOne<PrintJob, $this>
     */
    public function printJob(): HasOne
    {
        return $this->hasOne(PrintJob::class);
    }
}
