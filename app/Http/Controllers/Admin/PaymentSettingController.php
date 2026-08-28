<?php

namespace App\Http\Controllers\Admin;

use App\Enums\PayMongoMode;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StorePayMongoAccountRequest;
use App\Models\Business;
use App\Models\PayMongoAccount;
use App\Models\User;
use App\Services\Payments\PayMongoAccountVerifier;
use App\Services\Payments\PayMongoWebhookProvisioner;
use App\Services\Payments\TenantPayMongoAccountResolver;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;
use Throwable;

class PaymentSettingController extends Controller
{
    /**
     * Create the payment-settings controller with its payment boundaries.
     */
    public function __construct(
        private readonly PayMongoAccountVerifier $verifier,
        private readonly TenantPayMongoAccountResolver $resolver,
        private readonly PayMongoWebhookProvisioner $webhookProvisioner,
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
     * Verify, provision, and select a new immutable credential version.
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
            $newAccount = PayMongoAccount::query()->create([
                'business_id' => $business->id,
                'mode' => $mode,
                'public_key' => $publicKey,
                'secret_key' => $secretKey,
                'public_key_last4' => substr($publicKey, -4),
                'secret_key_last4' => substr($secretKey, -4),
                'verified_at' => now(),
                'created_by_user_id' => $business->owner_user_id,
            ]);
        } catch (Throwable) {
            return back()->withErrors([
                $this->connectionErrorKey($mode) => 'Unable to create the PayMongo credential version safely.',
            ]);
        }

        try {
            $this->webhookProvisioner->provision($newAccount);
        } catch (RuntimeException $exception) {
            $this->retireUnselectedAccount($newAccount);

            return back()->withErrors([
                $this->connectionErrorKey($mode) => $exception->getMessage(),
            ]);
        }

        try {
            $this->selectProvisionedAccount(
                $business,
                $mode,
                $newAccount,
            );
        } catch (Throwable) {
            $this->retireUnselectedAccount($newAccount);

            return back()->withErrors([
                $this->connectionErrorKey($mode) => 'Unable to activate the new PayMongo credential version safely.',
            ]);
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => ucfirst($mode->value).' PayMongo credentials verified and webhook provisioned.',
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
     * Recover the currently selected credential version's webhook configuration.
     */
    public function reprovision(
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
                $this->webhookErrorKey($mode) => 'The selected PayMongo configuration is invalid.',
            ]);
        }

        if ($account === null) {
            return back()->withErrors([
                $this->webhookErrorKey($mode) => 'Configure PayMongo credentials before recovering the webhook.',
            ]);
        }

        try {
            $this->verifier->verify(
                $mode,
                $account->public_key,
                $account->secret_key,
            );

            $account
                ->forceFill(['verified_at' => now()])
                ->save();

            $this->webhookProvisioner->recover($account->fresh());
        } catch (RuntimeException $exception) {
            return back()->withErrors([
                $this->webhookErrorKey($mode) => $exception->getMessage(),
            ]);
        }

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => ucfirst($mode->value).' PayMongo webhook recovered.',
        ]);

        return to_route('admin.payment-settings.edit');
    }

    /**
     * Re-verify and activate one fully operational Business payment mode.
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

        if (! $account->fresh()->isReadyForPayments()) {
            return back()->withErrors([
                $this->activationErrorKey($mode) => 'Provision or recover the PayMongo webhook before activating this mode.',
            ]);
        }

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
                    || ! $selectedAccount->isReadyForPayments()
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
        } catch (Throwable) {
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
     * Atomically select a credential version only after webhook provisioning succeeded.
     */
    private function selectProvisionedAccount(
        Business $business,
        PayMongoMode $mode,
        PayMongoAccount $account,
    ): void {
        DB::transaction(function () use (
            $business,
            $mode,
            $account,
        ): void {
            $lockedBusiness = Business::query()
                ->whereKey($business->id)
                ->lockForUpdate()
                ->firstOrFail();

            $candidate = PayMongoAccount::query()
                ->whereKey($account->id)
                ->where('business_id', $lockedBusiness->id)
                ->where('mode', $mode->value)
                ->whereNull('superseded_at')
                ->lockForUpdate()
                ->first();

            if (
                $candidate === null
                || ! $candidate->isReadyForPayments()
            ) {
                throw new RuntimeException(
                    'The new PayMongo account is not operational.',
                );
            }

            $previousAccount = $this->resolver->selectedForMode(
                $lockedBusiness,
                $mode,
            );

            if (
                $previousAccount !== null
                && $previousAccount->id !== $candidate->id
            ) {
                $previousAccount
                    ->forceFill(['superseded_at' => now()])
                    ->save();
            }

            $lockedBusiness
                ->forceFill([
                    $mode->businessPointerColumn() => $candidate->id,
                ])
                ->save();
        });
    }

    /**
     * Retire a credential version that failed before becoming Business-selected.
     */
    private function retireUnselectedAccount(
        PayMongoAccount $account,
    ): void {
        $account->refresh();

        if ($account->superseded_at !== null) {
            return;
        }

        $business = Business::query()
            ->find($account->business_id);

        if (! $business instanceof Business) {
            return;
        }

        $selectedAccountId = match ($account->mode) {
            PayMongoMode::Test => $business->test_paymongo_account_id,
            PayMongoMode::Live => $business->live_paymongo_account_id,
        };

        if ($selectedAccountId === $account->id) {
            return;
        }

        $account
            ->forceFill(['superseded_at' => now()])
            ->save();
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
     *     webhookReady: bool,
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
            'webhookReady' => $account?->isReadyForPayments() ?? false,
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
     * Get the mode-specific validation key for webhook recovery failures.
     */
    private function webhookErrorKey(PayMongoMode $mode): string
    {
        return $mode->value.'_webhook';
    }

    /**
     * Get the mode-specific validation key for activation failures.
     */
    private function activationErrorKey(PayMongoMode $mode): string
    {
        return $mode->value.'_activation';
    }
}
