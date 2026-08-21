<?php

namespace App\Models;

use Database\Factories\StickerDesignFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $name
 * @property string $asset_path
 * @property string|null $thumbnail_path
 * @property bool $active
 * @property int $sort_order
 * @property array<string, mixed>|null $placement
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'asset_path', 'thumbnail_path', 'active', 'sort_order', 'placement'])]
class StickerDesign extends Model
{
    /** @use HasFactory<StickerDesignFactory> */
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
            'sort_order' => 'integer',
            'placement' => 'array',
        ];
    }

    /**
     * Scope a query to only include sticker designs enabled for customer selection.
     *
     * @param  Builder<StickerDesign>  $query
     * @return Builder<StickerDesign>
     */
    #[Scope]
    protected function active(Builder $query): Builder
    {
        return $query->where('active', true);
    }

    /**
     * @return HasMany<PhotoboothSession, $this>
     */
    public function photoboothSessions(): HasMany
    {
        return $this->hasMany(PhotoboothSession::class);
    }

    /**
     * The photo templates this sticker is compatible with. An empty pivot
     * set means the sticker is compatible with all templates.
     *
     * @return BelongsToMany<PhotoTemplate, $this>
     */
    public function photoTemplates(): BelongsToMany
    {
        return $this->belongsToMany(PhotoTemplate::class, 'photo_template_sticker_design');
    }
}
