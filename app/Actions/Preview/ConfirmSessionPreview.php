<?php

namespace App\Actions\Preview;

use App\Enums\PhotoboothSessionStatus;
use App\Models\PhotoboothSession;

class ConfirmSessionPreview
{
    /**
     * Confirm the customer's composed preview and advance the session to Processing.
     *
     * Returns false when the session is expired, has no template selected, or is
     * already terminal or past Processing, in which case the session is not mutated.
     */
    public function handle(PhotoboothSession $session): bool
    {
        if ($session->expireIfPast()) {
            return false;
        }

        if ($session->photo_template_id === null) {
            return false;
        }

        $allowedStartingStatuses = [
            PhotoboothSessionStatus::TemplateSelected,
            PhotoboothSessionStatus::Capturing,
            PhotoboothSessionStatus::Customizing,
            PhotoboothSessionStatus::Processing,
        ];

        if (! in_array($session->status, $allowedStartingStatuses, true)) {
            return false;
        }

        while ($session->status !== PhotoboothSessionStatus::Processing) {
            $session->transitionTo($session->status->next());
        }

        return true;
    }
}
