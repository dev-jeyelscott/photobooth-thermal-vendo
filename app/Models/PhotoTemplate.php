<?php

namespace App\Models;

use Database\Factories\PhotoTemplateFactory;
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
 * @property string $slug
 * @property string $orientation
 * @property string $layout_path
 * @property string|null $thumbnail_path
 * @property int $photo_slots
 * @property array<string, mixed>|null $layout_config
 * @property int $print_width_mm
 * @property int $print_height_mm
 * @property bool $active
 * @property int $sort_order
 * @property array<string, mixed>|null $printer_compatibility
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'slug', 'orientation', 'layout_path', 'thumbnail_path', 'photo_slots', 'layout_config', 'print_width_mm', 'print_height_mm', 'active', 'sort_order', 'printer_compatibility'])]
class PhotoTemplate extends Model
{
    /** @use HasFactory<PhotoTemplateFactory> */
    use HasFactory;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'photo_slots' => 'integer',
            'layout_config' => 'array',
            'print_width_mm' => 'integer',
            'print_height_mm' => 'integer',
            'active' => 'boolean',
            'sort_order' => 'integer',
            'printer_compatibility' => 'array',
        ];
    }

    /**
     * Scope a query to only include templates enabled for customer selection.
     *
     * @param  Builder<PhotoTemplate>  $query
     * @return Builder<PhotoTemplate>
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
     * The sticker designs explicitly marked compatible with this template.
     * An empty pivot set means every active sticker is compatible.
     *
     * @return BelongsToMany<StickerDesign, $this>
     */
    public function stickerDesigns(): BelongsToMany
    {
        return $this->belongsToMany(StickerDesign::class, 'photo_template_sticker_design');
    }
}
