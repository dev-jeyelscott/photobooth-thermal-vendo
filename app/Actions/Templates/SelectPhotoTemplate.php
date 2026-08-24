<?php

namespace App\Actions\Templates;

use App\Enums\PhotoboothSessionStatus;
use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use Illuminate\Support\Facades\DB;

class SelectPhotoTemplate
{
    /**
     * Attach the given active template to the session, snapshot every
     * rendering-critical value, and advance it to TemplateSelected.
     *
     * Returns false when the session is expired, not currently PAID, or the
     * template is not active. The template row is locked before the session
     * snapshot is written so a concurrent frame replacement cannot invalidate
     * the selected rendering configuration.
     */
    public function handle(PhotoboothSession $session, int $photoTemplateId): bool
    {
        return DB::transaction(function () use ($session, $photoTemplateId): bool {
            $template = PhotoTemplate::active()
                ->whereKey($photoTemplateId)
                ->lockForUpdate()
                ->first();

            if ($template === null) {
                return false;
            }

            $lockedSession = PhotoboothSession::query()
                ->whereKey($session->id)
                ->lockForUpdate()
                ->first();

            if ($lockedSession === null || $lockedSession->expireIfPast()) {
                return false;
            }

            if (! $lockedSession->status->canTransitionTo(PhotoboothSessionStatus::TemplateSelected)) {
                return false;
            }

            $lockedSession->update([
                'photo_template_id' => $template->id,
                'template_snapshot' => [
                    'name' => $template->name,
                    'layout_path' => $template->layout_path,
                    'layout_config' => $template->layout_config,
                    'photo_slots' => $template->photo_slots,
                    'print_width_mm' => $template->print_width_mm,
                    'print_height_mm' => $template->print_height_mm,
                ],
            ]);

            $lockedSession->transitionTo(PhotoboothSessionStatus::TemplateSelected);

            return true;
        });
    }
}
