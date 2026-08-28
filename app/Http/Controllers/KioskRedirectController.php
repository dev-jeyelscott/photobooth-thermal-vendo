<?php

namespace App\Http\Controllers;

use App\Models\Business;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class KioskRedirectController extends Controller
{
    /**
     * Resolve the legacy kiosk entry point without inventing tenant context.
     */
    public function __invoke(Request $request): RedirectResponse
    {
        $user = $request->user();
        $business = $user?->business ?? $user?->ownedBusiness;

        if ($business === null) {
            $businesses = Business::query()
                ->orderBy('id')
                ->limit(2)
                ->get();

            abort_unless($businesses->count() === 1, 404);

            /** @var Business $business */
            $business = $businesses->first();
        }

        return to_route('business.kiosk', [
            'business' => $business,
        ]);
    }
}
