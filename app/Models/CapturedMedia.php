<?php

namespace App\Models;

use Database\Factories\CapturedMediaFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $photobooth_session_id
 * @property string|null $color_path
 * @property string|null $bw_path
 * @property string|null $gif_path
 * @property Carbon|null $expires_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['photobooth_session_id', 'color_path', 'bw_path', 'gif_path', 'expires_at'])]
class CapturedMedia extends Model
{
    /** @use HasFactory<CapturedMediaFactory> */
    use HasFactory;

    protected $table = 'captured_media';

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
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
