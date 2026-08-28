<?php

namespace App\Services\Payments;

use App\Enums\PayMongoMode;
use App\Models\Business;
use App\Models\PayMongoAccount;
use RuntimeException;

class TenantPayMongoAccountResolver
{
    /**
     * Resolve the verified account selected by the Business's active mode.
     */
    public function resolve(Business $business): PayMongoAccount
    {
        $mode = $business->active_paymongo_mode;

        $account = $this->selectedForMode($business, $mode);

        if ($account === null || $account->verified_at === null) {
            throw new RuntimeException(
                'The business does not have a verified PayMongo account for its active mode.',
            );
        }

        return $account;
    }

    /**
     * Resolve one Business-selected credential version without any fallback.
     */
    public function selectedForMode(
        Business $business,
        PayMongoMode $mode,
    ): ?PayMongoAccount {
        $accountId = match ($mode) {
            PayMongoMode::Test => $business->test_paymongo_account_id,
            PayMongoMode::Live => $business->live_paymongo_account_id,
        };

        if ($accountId === null) {
            return null;
        }

        $account = PayMongoAccount::query()
            ->whereKey($accountId)
            ->where('business_id', $business->id)
            ->where('mode', $mode->value)
            ->whereNull('superseded_at')
            ->first();

        if ($account === null) {
            throw new RuntimeException(
                'The selected PayMongo account does not belong to this business and mode.',
            );
        }

        return $account;
    }
}
