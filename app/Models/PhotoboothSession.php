<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use App\Enums\PhotoboothSessionStatus;
use App\Exceptions\InvalidPhotoboothSessionTransitionException;
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
 * @property string|null $price
 * @property string|null $currency
 * @property PaymentMethod|null $payment_method
 * @property int|null $required_capture_count
 * @property array{name?: string, layout_path?: string, layout_config: array<string, mixed>|null, photo_slots: int, print_width_mm: int, print_height_mm: int}|null $template_snapshot
 * @property array<string, mixed>|null $sticker_snapshot
 * @property Carbon|null $started_at
 * @property Carbon|null $expires_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable([
    'session_token',
    'status',
    'photo_template_id',
    'sticker_design_id',
    'voucher_id',
    'price',
    'currency',
    'payment_method',
    'required_capture_count',
    'template_snapshot',
    'sticker_snapshot',
    'started_at',
    'expires_at',
])]
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
            'price' => 'decimal:2',
            'payment_method' => PaymentMethod::class,
            'required_capture_count' => 'integer',
            'template_snapshot' => 'array',
            'sticker_snapshot' => 'array',
            'started_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    /**
     * Move this session to the given status, enforcing the allowed lifecycle transitions.
     *
     * @throws InvalidPhotoboothSessionTransitionException
     */
    public function transitionTo(PhotoboothSessionStatus $status): void
    {
        if (! $this->status->canTransitionTo($status)) {
            throw new InvalidPhotoboothSessionTransitionException($this->status, $status);
        }

        $this->update(['status' => $status]);
    }

    /**
     * Determine whether this session is past its expiration timestamp.
     */
    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    /**
     * Mark this session as expired if it is past due and not already in a terminal state.
     *
     * Returns whether the session is expired after this check.
     */
    public function expireIfPast(): bool
    {
        if ($this->status->isTerminal()) {
            return $this->status === PhotoboothSessionStatus::Expired;
        }

        if (! $this->isExpired()) {
            return false;
        }

        $this->update(['status' => PhotoboothSessionStatus::Expired]);

        return true;
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
