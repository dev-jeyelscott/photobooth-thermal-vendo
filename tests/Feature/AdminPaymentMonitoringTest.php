<?php

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Models\Payment;
use App\Models\PhotoboothSession;
use App\Models\User;
use Illuminate\Support\Facades\Route;

test('admin payment monitoring requires authentication', function () {
    $this->get(route('admin.payments.index'))->assertRedirect(route('login'));
});

test('admin payment monitoring exposes immutable evidence and all-time summaries', function () {
    $user = User::factory()->create();
    $session = PhotoboothSession::factory()->create(['currency' => 'PHP']);
    $payment = Payment::factory()->for($session, 'photoboothSession')->success()->create([
        'maya_payment_id' => 'payment-visible',
        'maya_checkout_id' => 'checkout-visible',
        'paid_at' => now(),
    ]);
    Payment::factory()->create(['status' => PaymentStatus::Pending]);
    Payment::factory()->create(['status' => PaymentStatus::Failed]);
    Payment::factory()->create(['status' => PaymentStatus::Cancelled]);

    $response = $this->actingAs($user)->get(route('admin.payments.index', [
        'status' => PaymentStatus::Success->value,
    ]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/payments/index')
        ->has('payments.data', 1)
        ->where('summary.total', 4)
        ->where('summary.successful', 1)
        ->where('summary.pending', 1)
        ->where('summary.failedOrCancelled', 2)
        ->where('payments.data.0.sessionToken', $session->session_token)
        ->where('payments.data.0.currency', 'PHP')
        ->where('payments.data.0.method', $payment->method->value)
        ->where('payments.data.0.status', PaymentStatus::Success->value)
        ->where('payments.data.0.mayaPaymentId', 'payment-visible')
        ->where('payments.data.0.mayaCheckoutId', 'checkout-visible')
        ->where('payments.data.0.paidAt', $payment->paid_at?->toIso8601String())
    );
});

test('admin can search payments by maya payment reference', function () {
    $user = User::factory()->create();
    $matching = Payment::factory()->success()->create([
        'maya_payment_id' => 'maya-search-reference-001',
    ]);
    Payment::factory()->success()->create([
        'maya_payment_id' => 'maya-other-reference-002',
    ]);

    $response = $this->actingAs($user)->get(route('admin.payments.index', [
        'search' => 'search-reference',
    ]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->has('payments.data', 1)
        ->where('payments.data.0.id', $matching->id)
        ->where('filters.search', 'search-reference')
    );
});

test('admin can search payments by related session token', function () {
    $user = User::factory()->create();
    $matchingSession = PhotoboothSession::factory()->create([
        'session_token' => '11111111-1111-4111-8111-000000000013',
    ]);
    $matching = Payment::factory()->for($matchingSession, 'photoboothSession')->create();
    Payment::factory()->create();

    $response = $this->actingAs($user)->get(route('admin.payments.index', [
        'search' => '000000000013',
    ]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->has('payments.data', 1)
        ->where('payments.data.0.id', $matching->id)
    );
});

test('admin can filter payments by persisted payment method', function () {
    $user = User::factory()->create();
    $matching = Payment::factory()->create(['method' => PaymentMethod::Voucher]);
    Payment::factory()->create(['method' => PaymentMethod::Maya]);

    $response = $this->actingAs($user)->get(route('admin.payments.index', [
        'method' => PaymentMethod::Voucher->value,
    ]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->has('payments.data', 1)
        ->where('payments.data.0.id', $matching->id)
        ->where('filters.method', PaymentMethod::Voucher->value)
    );
});

test('payment pagination preserves active search and status filters', function () {
    $user = User::factory()->create();

    foreach (range(1, 21) as $index) {
        Payment::factory()->create([
            'status' => PaymentStatus::Pending,
            'maya_checkout_id' => "batch-reference-{$index}",
        ]);
    }

    $response = $this->actingAs($user)->get(route('admin.payments.index', [
        'search' => 'batch-reference',
        'status' => PaymentStatus::Pending->value,
    ]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->where('payments.per_page', 20)
        ->where('payments.total', 21)
        ->where('payments.next_page_url', fn (?string $url) => $url !== null
            && str_contains($url, 'search=batch-reference')
            && str_contains($url, 'status=pending'))
    );
});

test('normal admin payment routes remain read only', function () {
    expect(Route::has('admin.payments.index'))->toBeTrue()
        ->and(Route::has('admin.payments.store'))->toBeFalse()
        ->and(Route::has('admin.payments.update'))->toBeFalse()
        ->and(Route::has('admin.payments.destroy'))->toBeFalse();
});
