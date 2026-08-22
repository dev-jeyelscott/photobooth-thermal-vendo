<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreVoucherRequest;
use App\Http\Requests\Admin\UpdateVoucherRequest;
use App\Models\PhotoboothSession;
use App\Models\Voucher;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class VoucherController extends Controller
{
    /**
     * List all vouchers for management.
     */
    public function index(): Response
    {
        $vouchers = Voucher::query()
            ->with('photoboothSessions')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Voucher $voucher) => $this->presentVoucher($voucher));

        return Inertia::render('admin/vouchers/index', [
            'vouchers' => $vouchers,
        ]);
    }

    /**
     * Show the form for creating a new voucher.
     */
    public function create(): Response
    {
        return Inertia::render('admin/vouchers/create');
    }

    /**
     * Store a newly created voucher.
     */
    public function store(StoreVoucherRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        Voucher::create([
            'code' => $validated['code'],
            'valid_from' => $validated['valid_from'] ?? null,
            'expires_at' => $validated['expires_at'] ?? null,
            'usage_limit' => $validated['usage_limit'],
            'active' => $request->boolean('active', true),
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Voucher created.')]);

        return to_route('admin.vouchers.index');
    }

    /**
     * Show the form for editing an existing voucher.
     */
    public function edit(Voucher $voucher): Response
    {
        $voucher->load('photoboothSessions');

        return Inertia::render('admin/vouchers/edit', [
            'voucher' => $this->presentVoucher($voucher),
        ]);
    }

    /**
     * Update an existing voucher's expiration and usage limit.
     */
    public function update(UpdateVoucherRequest $request, Voucher $voucher): RedirectResponse
    {
        $validated = $request->validated();

        $voucher->update([
            'code' => $validated['code'],
            'valid_from' => $validated['valid_from'] ?? null,
            'expires_at' => $validated['expires_at'] ?? null,
            'usage_limit' => $validated['usage_limit'],
            'active' => $request->boolean('active'),
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Voucher updated.')]);

        return to_route('admin.vouchers.index');
    }

    /**
     * Toggle a voucher's active flag.
     */
    public function toggle(Voucher $voucher): RedirectResponse
    {
        $voucher->update(['active' => ! $voucher->active]);

        return to_route('admin.vouchers.index');
    }

    /**
     * Delete a voucher.
     */
    public function destroy(Voucher $voucher): RedirectResponse
    {
        $voucher->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Voucher deleted.')]);

        return to_route('admin.vouchers.index');
    }

    /**
     * Present a voucher for the frontend.
     *
     * @return array<string, mixed>
     */
    private function presentVoucher(Voucher $voucher): array
    {
        return [
            'id' => $voucher->id,
            'code' => $voucher->code,
            'active' => $voucher->active,
            'validFrom' => $voucher->valid_from?->toIso8601String(),
            'expiresAt' => $voucher->expires_at?->toIso8601String(),
            'usageLimit' => $voucher->usage_limit,
            'usageCount' => $voucher->usage_count,
            'redemptions' => $voucher->photoboothSessions
                ->map(fn (PhotoboothSession $session) => [
                    'sessionToken' => $session->session_token,
                    'startedAt' => $session->started_at?->toIso8601String(),
                ])
                ->values()
                ->all(),
        ];
    }
}
