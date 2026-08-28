<?php

use App\Enums\PaymentStatus;
use App\Enums\PhotoboothSessionStatus;
use App\Models\Payment;
use App\Models\PhotoboothSession;
use Illuminate\Support\Facades\Log;

test('repeated reconciliation runs flag stale Maya payments without marking them successful', function () {
    Log::spy();

    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::PaymentPending,
    ]);
    $stalePayment = Payment::factory()->for($session, 'photoboothSession')->create([
        'status' => PaymentStatus::Pending,
        'maya_checkout_id' => 'checkout-stale',
        'created_at' => now()->subMinutes(16),
        'updated_at' => now()->subMinutes(16),
    ]);
    $freshPayment = Payment::factory()->create([
        'status' => PaymentStatus::Pending,
        'created_at' => now()->subMinutes(14),
        'updated_at' => now()->subMinutes(14),
    ]);

    $this->artisan('payments:reconcile-stale-maya')->assertSuccessful();
    $this->artisan('payments:reconcile-stale-maya')->assertSuccessful();

    expect($stalePayment->fresh()->status)->toBe(PaymentStatus::Pending)
        ->and($stalePayment->fresh()->paid_at)->toBeNull()
        ->and($freshPayment->fresh()->status)->toBe(PaymentStatus::Pending)
        ->and($session->fresh()->status)->toBe(PhotoboothSessionStatus::PaymentPending);

    Log::shouldHaveReceived('warning')
        ->twice()
        ->withArgs(fn (string $message, array $context): bool => str_contains($message, 'operator review')
            && $context['payment_id'] === $stalePayment->id
            && $context['maya_checkout_id'] === 'checkout-stale');
});
