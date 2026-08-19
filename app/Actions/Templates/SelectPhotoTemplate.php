<?php

namespace App\Actions\Templates;

use App\Enums\PhotoboothSessionStatus;
use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;

class SelectPhotoTemplate
{
    /**
     * Attach the given active template to the session and advance it to TemplateSelected.
     *
     * Returns false when the session is expired, not currently PAID, or the template
     * is not active, in which case neither the session nor the template is mutated.
     */
    public function handle(PhotoboothSession $session, int $photoTemplateId): bool
    {
        if ($session->expireIfPast()) {
            return false;
        }

        if (! $session->status->canTransitionTo(PhotoboothSessionStatus::TemplateSelected)) {
            return false;
        }

        $template = PhotoTemplate::active()->find($photoTemplateId);

        if ($template === null) {
            return false;
        }

        $session->update(['photo_template_id' => $template->id]);
        $session->transitionTo(PhotoboothSessionStatus::TemplateSelected);

        return true;
    }
}
