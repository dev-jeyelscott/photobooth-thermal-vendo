<?php

namespace App\Actions\Stickers;

use App\Models\PhotoboothSession;
use App\Models\StickerDesign;

class SelectStickerDesign
{
    /**
     * Attach the given active sticker design to the session.
     *
     * Returns false when the session is expired, has no template selected yet,
     * the sticker is not active, or the sticker is not compatible with the
     * session's selected template, in which case the session is not mutated.
     * Re-selecting updates the same column, so no duplicate records are created.
     */
    public function handle(PhotoboothSession $session, int $stickerDesignId): bool
    {
        if ($session->expireIfPast()) {
            return false;
        }

        if ($session->status->isTerminal()) {
            return false;
        }

        if ($session->photo_template_id === null) {
            return false;
        }

        $sticker = StickerDesign::active()->find($stickerDesignId);

        if ($sticker === null) {
            return false;
        }

        $isCompatible = ! $sticker->photoTemplates()->exists()
            || $sticker->photoTemplates()->where('photo_templates.id', $session->photo_template_id)->exists();

        if (! $isCompatible) {
            return false;
        }

        $session->update([
            'sticker_design_id' => $sticker->id,
            'sticker_snapshot' => [
                'asset_path' => $sticker->asset_path,
                'placement' => $sticker->placement,
            ],
        ]);

        return true;
    }
}
