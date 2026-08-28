<?php

namespace App\Http\Middleware;

use App\Models\Business;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $user,
                'canManagePaymentSettings' => $user instanceof User
                    && $this->canManagePaymentSettings($user),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state')
                || $request->cookie('sidebar_state') === 'true',
        ];
    }

    /**
     * Determine whether the authenticated user owns their assigned Business.
     */
    private function canManagePaymentSettings(User $user): bool
    {
        if ($user->business_id === null) {
            return false;
        }

        $business = $user->business()->first();

        return $business instanceof Business
            && Gate::forUser($user)->allows(
                'managePaymentSettings',
                $business,
            );
    }
}
