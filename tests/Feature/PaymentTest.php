<?php

use App\Actions\Payments\CreateMayaCheckout;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PhotoboothSessionStatus;
use App\Models\ApplicationSetting;
use App\Models\Payment;
use App\Models\PhotoboothSession;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;
use RuntimeException;

beforeEach(function () {
    ApplicationSetting::factory()->create([
        'key' => 'session_price',
        'value' => '150.00',
    ]);
});

test('a maya checkout session is created and associated with the photobooth session', function () {
    Http::fake([
        '*/checkout/v1/checkouts' => Http::response([
            'checkoutId' => 'checkout-123',
            'redirectUrl' => 'https://pg-sandbox.paymaya.com/checkout/checkout-123',
        ], 200),
    ]);

    $session = PhotoboothSession::factory()->create();

    $response = $this->postJson(route('kiosk.sessions.payments.store', $session->session_token));

    $response->assertCreated();
    $response->assertJson([
        'checkoutUrl' => 'https://pg-sandbox.paymaya.com/checkout/checkout-123',
    ]);

    $payment = Payment::first();

    expect($payment)->not->toBeNull()
        ->and($payment->photobooth_session_id)->toBe($session->id)
        ->and($payment->status)->toBe(PaymentStatus::Pending)
        ->and($payment->maya_checkout_id)->toBe('checkout-123')
        ->and((float) $payment->amount)->toBe(150.0);
});

test('a second active payment request for the same session is rejected', function () {
    Http::fake([
        '*/checkout/v1/checkouts' => Http::response([
            'checkoutId' => 'checkout-123',
            'redirectUrl' => 'https://pg-sandbox.paymaya.com/checkout/checkout-123',
        ], 200),
    ]);

    $session = PhotoboothSession::factory()->create();
    Payment::factory()->for($session, 'photoboothSession')->create(['status' => PaymentStatus::Pending]);

    $response = $this->postJson(route('kiosk.sessions.payments.store', $session->session_token));

    $response->assertStatus(409);
    expect(Payment::count())->toBe(1);
});

test('a new payment request is allowed once the prior payment has failed', function () {
    Http::fake([
        '*/checkout/v1/checkouts' => Http::response([
            'checkoutId' => 'checkout-456',
            'redirectUrl' => 'https://pg-sandbox.paymaya.com/checkout/checkout-456',
        ], 200),
    ]);

    $session = PhotoboothSession::factory()->create();
    Payment::factory()->for($session, 'photoboothSession')->create(['status' => PaymentStatus::Failed]);

    $response = $this->postJson(route('kiosk.sessions.payments.store', $session->session_token));

    $response->assertCreated();
    expect(Payment::count())->toBe(2);
});

test('a retried checkout after a failed payment charges and keeps the original session snapshot even after settings change', function () {
    config(['photobooth.capture_shot_count' => 4]);

    Http::fake([
        '*/checkout/v1/checkouts' => Http::sequence()
            ->push([
                'checkoutId' => 'checkout-initial',
                'redirectUrl' => 'https://pg-sandbox.paymaya.com/checkout/checkout-initial',
            ], 200)
            ->push([
                'checkoutId' => 'checkout-retry',
                'redirectUrl' => 'https://pg-sandbox.paymaya.com/checkout/checkout-retry',
            ], 200),
    ]);

    $session = PhotoboothSession::factory()->create();

    $this->postJson(route('kiosk.sessions.payments.store', $session->session_token))->assertCreated();

    Payment::first()->update(['status' => PaymentStatus::Failed]);

    ApplicationSetting::where('key', 'session_price')->update(['value' => '999.00']);
    config(['photobooth.capture_shot_count' => 10]);

    $response = $this->postJson(route('kiosk.sessions.payments.store', $session->session_token));

    $response->assertCreated();

    $retryPayment = Payment::where('maya_checkout_id', 'checkout-retry')->firstOrFail();

    expect((float) $retryPayment->amount)->toBe(150.0)
        ->and((float) $session->fresh()->price)->toBe(150.0)
        ->and($session->fresh()->required_capture_count)->toBe(4);
});

test('a payment request for an already paid session is rejected without creating a payment', function () {
    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::Paid]);

    $response = $this->postJson(route('kiosk.sessions.payments.store', $session->session_token));

    $response->assertStatus(409);
    expect(Payment::count())->toBe(0)
        ->and($session->fresh()->status)->toBe(PhotoboothSessionStatus::Paid);
});

test('a payment request for a completed session is rejected without creating a payment', function () {
    $session = PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::Completed]);

    $response = $this->postJson(route('kiosk.sessions.payments.store', $session->session_token));

    $response->assertStatus(409);
    expect(Payment::count())->toBe(0)
        ->and($session->fresh()->status)->toBe(PhotoboothSessionStatus::Completed);
});

test('a maya checkout snapshots the price, currency, payment method, and required capture count on the session', function () {
    config(['photobooth.capture_shot_count' => 4]);

    Http::fake([
        '*/checkout/v1/checkouts' => Http::response([
            'checkoutId' => 'checkout-123',
            'redirectUrl' => 'https://pg-sandbox.paymaya.com/checkout/checkout-123',
        ], 200),
    ]);

    $session = PhotoboothSession::factory()->create();

    $this->postJson(route('kiosk.sessions.payments.store', $session->session_token))->assertCreated();

    $session->refresh();

    expect((float) $session->price)->toBe(150.0)
        ->and($session->currency)->toBe('PHP')
        ->and($session->payment_method)->toBe(PaymentMethod::Maya)
        ->and($session->required_capture_count)->toBe(4);
});

test('changing the session price setting after checkout does not alter an already snapshotted session', function () {
    Http::fake([
        '*/checkout/v1/checkouts' => Http::response([
            'checkoutId' => 'checkout-123',
            'redirectUrl' => 'https://pg-sandbox.paymaya.com/checkout/checkout-123',
        ], 200),
    ]);

    $session = PhotoboothSession::factory()->create();

    $this->postJson(route('kiosk.sessions.payments.store', $session->session_token))->assertCreated();

    ApplicationSetting::where('key', 'session_price')->update(['value' => '999.00']);

    expect((float) $session->fresh()->price)->toBe(150.0);
});

test('no maya secret key appears in the checkout response', function () {
    config(['services.maya.secret_key' => 'sk_super_secret_value']);

    Http::fake([
        '*/checkout/v1/checkouts' => Http::response([
            'checkoutId' => 'checkout-789',
            'redirectUrl' => 'https://pg-sandbox.paymaya.com/checkout/checkout-789',
        ], 200),
    ]);

    $session = PhotoboothSession::factory()->create();

    $response = $this->postJson(route('kiosk.sessions.payments.store', $session->session_token));

    $response->assertCreated();
    $response->assertDontSee('sk_super_secret_value');
});

test('a concurrent duplicate checkout guard tripped mid-transaction leaves no partial payment or session snapshot', function () {
    Http::fake([
        '*/checkout/v1/checkouts' => Http::response([
            'checkoutId' => 'checkout-race',
            'redirectUrl' => 'https://pg-sandbox.paymaya.com/checkout/checkout-race',
        ], 200),
    ]);

    $session = PhotoboothSession::factory()->create();

    // Simulates a second concurrent checkout request landing after the
    // Maya API call has already succeeded but before the local write commits.
    Payment::factory()->for($session, 'photoboothSession')->create(['status' => PaymentStatus::Pending]);

    expect(fn () => app(CreateMayaCheckout::class)->handle($session))
        ->toThrow(RuntimeException::class);

    expect(Payment::count())->toBe(1)
        ->and(Payment::first()->maya_checkout_id)->not->toBe('checkout-race')
        ->and($session->fresh()->price)->toBeNull()
        ->and($session->fresh()->payment_method)->toBeNull();
});

test('a duplicate maya_checkout_id is rejected at the database layer', function () {
    Payment::factory()->create(['maya_checkout_id' => 'checkout-duplicate']);

    expect(fn () => Payment::factory()->create(['maya_checkout_id' => 'checkout-duplicate']))
        ->toThrow(QueryException::class);
});

test('a duplicate maya_payment_id is rejected at the database layer', function () {
    Payment::factory()->create(['maya_payment_id' => 'payment-duplicate']);

    expect(fn () => Payment::factory()->create(['maya_payment_id' => 'payment-duplicate']))
        ->toThrow(QueryException::class);
});

test('multiple pending payments without a maya reference can coexist', function () {
    Payment::factory()->count(2)->create([
        'maya_checkout_id' => null,
        'maya_payment_id' => null,
    ]);

    expect(Payment::count())->toBe(2);
});

test('admin payment index requires authentication', function () {
    $this->get(route('admin.payments.index'))->assertRedirect(route('login'));
});

test('admin can view a paginated list of payments with evidence fields', function () {
    $user = User::factory()->create();
    $session = PhotoboothSession::factory()->create();
    $payment = Payment::factory()->for($session, 'photoboothSession')->success()->create([
        'maya_payment_id' => 'payment-visible',
        'maya_checkout_id' => 'checkout-visible',
    ]);

    $response = $this->actingAs($user)->get(route('admin.payments.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/payments/index')
        ->where('payments.data.0.sessionToken', $session->session_token)
        ->where('payments.data.0.method', $payment->method->value)
        ->where('payments.data.0.status', PaymentStatus::Success->value)
        ->where('payments.data.0.mayaPaymentId', 'payment-visible')
        ->where('payments.data.0.mayaCheckoutId', 'checkout-visible')
        ->where('payments.data.0.amount', $payment->amount)
    );
});

test('admin can filter payments by status', function () {
    $user = User::factory()->create();
    $matching = Payment::factory()->success()->create();
    Payment::factory()->create(['status' => PaymentStatus::Pending]);

    $response = $this->actingAs($user)->get(route('admin.payments.index', ['status' => 'success']));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/payments/index')
        ->has('payments.data', 1)
        ->where('payments.data.0.mayaCheckoutId', $matching->maya_checkout_id)
    );
});

test('admin can filter payments by date range', function () {
    $user = User::factory()->create();
    $inRange = Payment::factory()->create(['created_at' => now()->subDays(1)]);
    Payment::factory()->create(['created_at' => now()->subDays(10)]);

    $response = $this->actingAs($user)->get(route('admin.payments.index', [
        'from' => now()->subDays(2)->toDateString(),
        'to' => now()->toDateString(),
    ]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/payments/index')
        ->has('payments.data', 1)
        ->where('payments.data.0.mayaCheckoutId', $inRange->maya_checkout_id)
    );
});

test('the admin payment response never exposes maya secret credentials', function () {
    config(['services.maya.secret_key' => 'sk_super_secret_value']);

    $user = User::factory()->create();
    Payment::factory()->success()->create();

    $response = $this->actingAs($user)->get(route('admin.payments.index'));

    $response->assertOk();
    $response->assertDontSee('sk_super_secret_value');
});

test('no admin route exists that can mutate a payment status', function () {
    $adminPaymentRoutes = collect(Route::getRoutes())
        ->filter(fn ($route) => str_starts_with($route->getName() ?? '', 'admin.payments.'));

    expect($adminPaymentRoutes)->toHaveCount(1);

    $indexRoute = $adminPaymentRoutes->first();

    expect($indexRoute->getName())->toBe('admin.payments.index')
        ->and($indexRoute->methods())->toEqualCanonicalizing(['GET', 'HEAD']);
});
