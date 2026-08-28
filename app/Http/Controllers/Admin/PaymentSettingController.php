<?php

namespace App\Http\Controllers\Admin;

use App\Enums\PayMongoMode;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StorePayMongoAccountRequest;
use App\Models\Business;
use App\Models\PayMongoAccount;
use App\Models\User;
use App\Services\Payments\PayMongoAccountVerifier;
use App\Services\Payments\TenantPayMongoAccountResolver;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class PaymentSettingController extends Controller
{
    /**
     * Create the payment-settings controller with its payment boundaries.
     */
    public function __construct(
        private readonly PayMongoAccountVerifier $verifier,
        private readonly TenantPayMongoAccountResolver $resolver,
    ) {}

    /**
     * Render owner-only masked PayMongo configuration for the current Business.
     */
    public function edit(Request $request): Response
    {
        $business = $this->authorizedBusiness($request);

        return Inertia::render('admin/payment-settings/edit', [
            'businessName' => $business->name,
            'activeMode' => $business->active_paymongo_mode->value,
            'accounts' => [
                PayMongoMode::Test->value => $this->accountSummary(
                    $this->resolver->selectedForMode(
                        $business,
                        PayMongoMode::Test,
                    ),
                    PayMongoMode::Test,
                ),
                PayMongoMode::Live->value => $this->accountSummary(
                    $this->resolver->selectedForMode(
                        $business,
                        PayMongoMode::Live,
                    ),
                    PayMongoMode::Live,
                ),
            ],
        ]);
    }

    /**
     * Verify and create a new immutable credential version for one mode.
     */
    public function replace(
        StorePayMongoAccountRequest $request,
        PayMongoMode $mode,
    ): RedirectResponse {
        $business = $this->authorizedBusiness($request);
        $publicKey = (string) $request->validated('public_key');
        $secretKey = (string) $request->validated('secret_key');

        try {
            $this->verifier->verify(
                $mode,
                $publicKey,
                $secretKey,
            );
        } catch (RuntimeException $exception) {
            return back()->withErrors([
                $this->connectionErrorKey($mode) => $exception->getMessage(),
            ]);
        }

        try {
            DB::transaction(function () use (
                $business,
                $mode,
                $publicKey,
                $secretKey,
            ): void {
                $lockedBusiness = Business::query()
                    ->whereKey($business->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                $previousAccount = $this->resolver->selectedForMode(
                    $lockedBusiness,
                    $mode,
                );

                $newAccount = PayMongoAccount::query()->create([
                    'business_id' => $lockedBusiness->id,
                    'mode' => $mode,
                    'public_key' => $publicKey,
                    'secret_key' => $secretKey,
                    'public_key_last4' => substr($publicKey, -4),
                    'secret_key_last4' => substr($secretKey, -4),
                    'verified_at' => now(),
                    'created_by_user_id' => $lockedBusiness->owner_user_id,
                ]);

                if ($previousAccount !== null) {
                    $previousAccount
                        ->forceFill(['superseded_at' => now()])
                        ->save();
                }

                $lockedBusiness
                    ->forceFill([
                        $mode->businessPointerColumn() => $newAccount->id,
                    ])
                    ->save();
            });
        } catch (RuntimeException) {
            return back()->withErrors([
                $this->connectionErrorKey($mode) => 'Unable to replace PayMongo credentials safely.',
            ]);
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => ucfirst($mode->value).' PayMongo credentials replaced.',
        ]);

        return to_route('admin.payment-settings.edit');
    }

    /**
     * Re-verify the currently selected credential version for one mode.
     */
    public function test(
        Request $request,
        PayMongoMode $mode,
    ): RedirectResponse {
        $business = $this->authorizedBusiness($request);

        try {
            $account = $this->resolver->selectedForMode(
                $business,
                $mode,
            );
        } catch (RuntimeException) {
            return back()->withErrors([
                $this->connectionErrorKey($mode) => 'The selected PayMongo configuration is invalid.',
            ]);
        }

        if ($account === null) {
            return back()->withErrors([
                $this->connectionErrorKey($mode) => 'No PayMongo credentials are configured for this mode.',
            ]);
        }

        try {
            $this->verifier->verify(
                $mode,
                $account->public_key,
                $account->secret_key,
            );
        } catch (RuntimeException $exception) {
            $account
                ->forceFill(['verified_at' => null])
                ->save();

            return back()->withErrors([
                $this->connectionErrorKey($mode) => $exception->getMessage(),
            ]);
        }

        $account
            ->forceFill(['verified_at' => now()])
            ->save();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => ucfirst($mode->value).' PayMongo connection verified.',
        ]);

        return to_route('admin.payment-settings.edit');
    }

    /**
     * Re-verify and activate one configured Business payment mode.
     */
    public function activate(
        Request $request,
        PayMongoMode $mode,
    ): RedirectResponse {
        $business = $this->authorizedBusiness($request);

        try {
            $account = $this->resolver->selectedForMode(
                $business,
                $mode,
            );
        } catch (RuntimeException) {
            return back()->withErrors([
                $this->activationErrorKey($mode) => 'The selected PayMongo configuration is invalid.',
            ]);
        }

        if ($account === null) {
            return back()->withErrors([
                $this->activationErrorKey($mode) => 'Configure this PayMongo mode before activating it.',
            ]);
        }

        try {
            $this->verifier->verify(
                $mode,
                $account->public_key,
                $account->secret_key,
            );
        } catch (RuntimeException $exception) {
            $account
                ->forceFill(['verified_at' => null])
                ->save();

            return back()->withErrors([
                $this->activationErrorKey($mode) => $exception->getMessage(),
            ]);
        }

        $account
            ->forceFill(['verified_at' => now()])
            ->save();

        try {
            DB::transaction(function () use (
                $business,
                $mode,
                $account,
            ): void {
                $lockedBusiness = Business::query()
                    ->whereKey($business->id)
                    ->lockForUpdate()
                    ->firstOrFail();

                $selectedAccount = $this->resolver->selectedForMode(
                    $lockedBusiness,
                    $mode,
                );

                if (
                    $selectedAccount === null
                    || $selectedAccount->id !== $account->id
                    || $selectedAccount->verified_at === null
                ) {
                    throw new RuntimeException(
                        'The PayMongo account changed before activation.',
                    );
                }

                $lockedBusiness
                    ->forceFill([
                        'active_paymongo_mode' => $mode,
                    ])
                    ->save();
            });
        } catch (RuntimeException) {
            return back()->withErrors([
                $this->activationErrorKey($mode) => 'Unable to activate this PayMongo mode safely.',
            ]);
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => ucfirst($mode->value).' PayMongo mode activated.',
        ]);

        return to_route('admin.payment-settings.edit');
    }

    /**
     * Resolve and authorize the authenticated user's Business.
     */
    private function authorizedBusiness(Request $request): Business
    {
        $user = $request->user();

        abort_unless(
            $user instanceof User && $user->business_id !== null,
            403,
        );

        $business = $user->business()->first();

        abort_unless($business instanceof Business, 403);

        Gate::forUser($user)->authorize(
            'managePaymentSettings',
            $business,
        );

        return $business;
    }

    /**
     * Build a secret-free account summary for Inertia presentation.
     *
     * @return array{
     *     mode: string,
     *     configured: bool,
     *     maskedPublicKey: string|null,
     *     maskedSecretKey: string|null,
     *     verifiedAt: string|null,
     *     webhookStatus: string|null,
     *     webhookProvisionedAt: string|null,
     *     supersededAt: string|null
     * }
     */
    private function accountSummary(
        ?PayMongoAccount $account,
        PayMongoMode $mode,
    ): array {
        return [
            'mode' => $mode->value,
            'configured' => $account !== null,
            'maskedPublicKey' => $this->maskCredential(
                $mode->publicKeyPrefix(),
                $account?->public_key_last4,
            ),
            'maskedSecretKey' => $this->maskCredential(
                $mode->secretKeyPrefix(),
                $account?->secret_key_last4,
            ),
            'verifiedAt' => $account?->verified_at?->toIso8601String(),
            'webhookStatus' => $account?->webhook_status,
            'webhookProvisionedAt' => $account
                ?->webhook_provisioned_at
                ?->toIso8601String(),
            'supersededAt' => $account
                ?->superseded_at
                ?->toIso8601String(),
        ];
    }

    /**
     * Mask a credential using only its known prefix and stored final characters.
     */
    private function maskCredential(
        string $prefix,
        ?string $last4,
    ): ?string {
        if ($last4 === null) {
            return null;
        }

        return $prefix.'••••'.$last4;
    }

    /**
     * Get the mode-specific validation key for connection failures.
     */
    private function connectionErrorKey(PayMongoMode $mode): string
    {
        return $mode->value.'_connection';
    }

    /**
     * Get the mode-specific validation key for activation failures.
     */
    private function activationErrorKey(PayMongoMode $mode): string
    {
        return $mode->value.'_activation';
    }
}
