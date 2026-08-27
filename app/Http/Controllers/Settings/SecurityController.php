<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\PasswordUpdateRequest;
use App\Http\Requests\Settings\TwoFactorAuthenticationRequest;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;
use Laravel\Fortify\Features;

class SecurityController extends Controller
{
    /**
     * Show the user's security settings page.
     */
    public function edit(TwoFactorAuthenticationRequest $request): Response
    {
        $canManageTwoFactor = Features::canManageTwoFactorAuthentication();
        $canManagePasskeys = Features::canManagePasskeys();

        $props = [
            'canManageTwoFactor' => $canManageTwoFactor,
            'canManagePasskeys' => $canManagePasskeys,
            'passkeys' => $canManagePasskeys
                ? $request->user()
                    ->passkeys()
                    ->select(['id', 'name', 'credential', 'created_at', 'last_used_at'])
                    ->latest()
                    ->get()
                    ->map(fn ($passkey) => [
                        'id' => $passkey->id,
                        'name' => $passkey->name,
                        'authenticator' => $passkey->authenticator,
                        'created_at_diff' => $passkey->created_at->diffForHumans(),
                        'last_used_at_diff' => $passkey->last_used_at?->diffForHumans(),
                    ])
                    ->values()
                    ->all()
                : [],
            'passwordRules' => Password::defaults()->toPasswordRulesString(),
            'activeSessions' => $this->activeSessions($request),
        ];

        if ($canManageTwoFactor) {
            $request->ensureStateIsValid();

            $props['twoFactorEnabled'] = $request->user()->hasEnabledTwoFactorAuthentication();
            $props['requiresConfirmation'] = Features::optionEnabled(
                Features::twoFactorAuthentication(),
                'confirm',
            );
        }

        return Inertia::render('settings/security', $props);
    }

    /**
     * Update the user's password.
     */
    public function update(PasswordUpdateRequest $request): RedirectResponse
    {
        $request->user()->update([
            'password' => $request->password,
        ]);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Password updated.'),
        ]);

        return back();
    }

    /**
     * Revoke one non-current database session owned by the authenticated user.
     */
    public function destroySession(Request $request, string $sessionId): RedirectResponse
    {
        abort_unless(config('session.driver') === 'database', 404);

        if ($sessionId === $request->session()->getId()) {
            Inertia::flash('toast', [
                'type' => 'error',
                'message' => __('The current session cannot be revoked from this control.'),
            ]);

            return back();
        }

        $deleted = DB::table((string) config('session.table', 'sessions'))
            ->where('user_id', $request->user()->getAuthIdentifier())
            ->where('id', $sessionId)
            ->delete();

        abort_if($deleted === 0, 404);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => __('Session revoked.'),
        ]);

        return back();
    }

    /**
     * Return authenticated-user session evidence when Laravel uses its
     * database session driver.
     *
     * @return array<int, array{
     *     id: string,
     *     device: string,
     *     ipAddress: string|null,
     *     lastActiveAt: string,
     *     isCurrent: bool
     * }>|null
     */
    private function activeSessions(Request $request): ?array
    {
        if (config('session.driver') !== 'database') {
            return null;
        }

        $currentSessionId = $request->session()->getId();

        return DB::table((string) config('session.table', 'sessions'))
            ->where('user_id', $request->user()->getAuthIdentifier())
            ->orderByDesc('last_activity')
            ->get(['id', 'ip_address', 'user_agent', 'last_activity'])
            ->map(function (object $session) use ($currentSessionId): array {
                $sessionId = (string) $session->id;

                return [
                    'id' => $sessionId,
                    'device' => $this->describeUserAgent(
                        is_string($session->user_agent)
                            ? $session->user_agent
                            : null,
                    ),
                    'ipAddress' => is_string($session->ip_address)
                        ? $session->ip_address
                        : null,
                    'lastActiveAt' => CarbonImmutable::createFromTimestampUTC(
                        (int) $session->last_activity,
                    )->toIso8601String(),
                    'isCurrent' => $sessionId === $currentSessionId,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * Convert stored browser evidence into a conservative device label without
     * claiming browser versions or geographic information.
     */
    private function describeUserAgent(?string $userAgent): string
    {
        if ($userAgent === null || trim($userAgent) === '') {
            return 'Browser session';
        }

        $browser = match (true) {
            Str::contains($userAgent, ['Edg/', 'EdgiOS/']) => 'Edge',
            Str::contains($userAgent, ['Firefox/', 'FxiOS/']) => 'Firefox',
            Str::contains($userAgent, ['Chrome/', 'CriOS/']) => 'Chrome',
            Str::contains($userAgent, 'Safari/') => 'Safari',
            default => 'Browser',
        };

        $platform = match (true) {
            Str::contains($userAgent, ['iPhone', 'iPad']) => 'iOS',
            Str::contains($userAgent, 'Android') => 'Android',
            Str::contains($userAgent, 'Windows') => 'Windows',
            Str::contains($userAgent, 'Macintosh') => 'macOS',
            Str::contains($userAgent, 'Linux') => 'Linux',
            default => null,
        };

        return $platform === null
            ? $browser
            : "{$browser} on {$platform}";
    }
}
