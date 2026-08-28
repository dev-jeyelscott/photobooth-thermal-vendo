<?php

namespace App\Policies;

use App\Models\Business;
use App\Models\User;

class BusinessPolicy
{
    /**
     * Determine whether the user may manage this Business's payment credentials.
     */
    public function managePaymentSettings(User $user, Business $business): bool
    {
        return $user->business_id === $business->id
            && $business->owner_user_id === $user->id;
    }
}
