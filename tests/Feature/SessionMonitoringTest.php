<?php

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PhotoboothSessionStatus;
use App\Enums\PrintJobStatus;
use App\Models\Payment;
use App\Models\PhotoboothSession;
use App\Models\PrintJob;
use App\Models\User;
use App\Models\Voucher;

test('session monitoring requires authentication', function () {
    $this->get(route('admin.sessions.index'))->assertRedirect(route('login'));
});

test('admin can view session evidence and all-time summary data', function () {
    $user = User::factory()->create();
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Completed,
        'price' => '200.00',
        'currency' => 'PHP',
        'payment_method' => PaymentMethod::Maya,
        'template_snapshot' => [
            'name' => 'Classic 4R',
            'layout_config' => null,
            'photo_slots' => 4,
            'print_width_mm' => 100,
            'print_height_mm' => 150,
        ],
    ]);
    $payment = Payment::factory()->for($session, 'photoboothSession')->success()->create();
    $printJob = PrintJob::factory()->for($session, 'photoboothSession')->printed()->create();

    $response = $this->actingAs($user)->get(route('admin.sessions.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/sessions/index')
        ->where('summary.total', 1)
        ->where('summary.completed', 1)
        ->where('summary.inProgress', 0)
        ->where('summary.expiredOrAbandoned', 0)
        ->where('sessions.data.0.sessionToken', $session->session_token)
        ->where('sessions.data.0.status', PhotoboothSessionStatus::Completed->value)
        ->where('sessions.data.0.templateName', 'Classic 4R')
        ->where('sessions.data.0.price', '200.00')
        ->where('sessions.data.0.currency', 'PHP')
        ->where('sessions.data.0.paymentMethod', PaymentMethod::Maya->value)
        ->where('sessions.data.0.payment.method', $payment->method->value)
        ->where('sessions.data.0.payment.status', PaymentStatus::Success->value)
        ->where('sessions.data.0.printJob.status', PrintJobStatus::Printed->value)
    );
});

test('session summaries cover every durable lifecycle group independently of pagination filters', function () {
    $user = User::factory()->create();

    PhotoboothSession::factory()->count(2)->create(['status' => PhotoboothSessionStatus::Completed]);
    PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::PaymentPending]);
    PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::Capturing]);
    PhotoboothSession::factory()->expired()->create();
    PhotoboothSession::factory()->create(['status' => PhotoboothSessionStatus::Abandoned]);

    $response = $this->actingAs($user)->get(route('admin.sessions.index', [
        'status' => PhotoboothSessionStatus::Completed->value,
    ]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->has('sessions.data', 2)
        ->where('summary.total', 6)
        ->where('summary.completed', 2)
        ->where('summary.inProgress', 2)
        ->where('summary.expiredOrAbandoned', 2)
    );
});

test('admin can search sessions by session token', function () {
    $user = User::factory()->create();
    $matching = PhotoboothSession::factory()->create([
        'session_token' => '11111111-1111-4111-8111-000000000013',
    ]);
    PhotoboothSession::factory()->create([
        'session_token' => '22222222-2222-4222-8222-000000000014',
    ]);

    $response = $this->actingAs($user)->get(route('admin.sessions.index', [
        'search' => '000000000013',
    ]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->has('sessions.data', 1)
        ->where('sessions.data.0.sessionToken', $matching->session_token)
        ->where('filters.search', '000000000013')
    );
});

test('admin can filter sessions by status', function () {
    $user = User::factory()->create();
    $expired = PhotoboothSession::factory()->expired()->create();
    PhotoboothSession::factory()->create();

    $response = $this->actingAs($user)->get(route('admin.sessions.index', ['status' => 'expired']));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/sessions/index')
        ->has('sessions.data', 1)
        ->where('sessions.data.0.sessionToken', $expired->session_token)
    );
});

test('admin can filter sessions by payment status', function () {
    $user = User::factory()->create();
    $matching = PhotoboothSession::factory()->create();
    Payment::factory()->for($matching, 'photoboothSession')->success()->create();
    $other = PhotoboothSession::factory()->create();
    Payment::factory()->for($other, 'photoboothSession')->create();

    $response = $this->actingAs($user)->get(route('admin.sessions.index', ['payment_status' => 'success']));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/sessions/index')
        ->has('sessions.data', 1)
        ->where('sessions.data.0.sessionToken', $matching->session_token)
    );
});

test('admin can filter sessions by payment method', function () {
    $user = User::factory()->create();
    $matching = PhotoboothSession::factory()->create();
    Payment::factory()->for($matching, 'photoboothSession')->create(['method' => PaymentMethod::Maya]);
    $other = PhotoboothSession::factory()->create();
    Payment::factory()->for($other, 'photoboothSession')->create(['method' => PaymentMethod::Voucher]);

    $response = $this->actingAs($user)->get(route('admin.sessions.index', ['payment_method' => 'maya']));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/sessions/index')
        ->has('sessions.data', 1)
        ->where('sessions.data.0.sessionToken', $matching->session_token)
    );
});

test('admin can filter sessions by voucher authorization type', function () {
    $user = User::factory()->create();
    $voucher = Voucher::factory()->create();
    $matching = PhotoboothSession::factory()->create(['voucher_id' => $voucher->id]);
    PhotoboothSession::factory()->create();

    $response = $this->actingAs($user)->get(route('admin.sessions.index', ['authorization_type' => 'voucher']));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/sessions/index')
        ->has('sessions.data', 1)
        ->where('sessions.data.0.sessionToken', $matching->session_token)
        ->where('sessions.data.0.voucherCode', $voucher->code)
    );
});

test('admin can filter sessions by payment authorization type', function () {
    $user = User::factory()->create();
    $matching = PhotoboothSession::factory()->create();
    Payment::factory()->for($matching, 'photoboothSession')->create();
    PhotoboothSession::factory()->create();

    $response = $this->actingAs($user)->get(route('admin.sessions.index', ['authorization_type' => 'payment']));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/sessions/index')
        ->has('sessions.data', 1)
        ->where('sessions.data.0.sessionToken', $matching->session_token)
    );
});

test('admin can filter sessions by print status', function () {
    $user = User::factory()->create();
    $matching = PhotoboothSession::factory()->create();
    PrintJob::factory()->for($matching, 'photoboothSession')->printed()->create();
    $other = PhotoboothSession::factory()->create();
    PrintJob::factory()->for($other, 'photoboothSession')->failed()->create();

    $response = $this->actingAs($user)->get(route('admin.sessions.index', ['print_status' => 'printed']));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/sessions/index')
        ->has('sessions.data', 1)
        ->where('sessions.data.0.sessionToken', $matching->session_token)
    );
});

test('session pagination preserves active query filters', function () {
    $user = User::factory()->create();
    PhotoboothSession::factory()->count(21)->create([
        'status' => PhotoboothSessionStatus::Completed,
    ]);

    $response = $this->actingAs($user)->get(route('admin.sessions.index', [
        'status' => PhotoboothSessionStatus::Completed->value,
    ]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->where('sessions.per_page', 20)
        ->where('sessions.total', 21)
        ->where('sessions.next_page_url', fn (?string $url) => $url !== null && str_contains($url, 'status=completed'))
    );
});

test('invalid enum filter values remain safely ignored', function () {
    $user = User::factory()->create();
    PhotoboothSession::factory()->create();

    $response = $this->actingAs($user)->get(route('admin.sessions.index', [
        'status' => 'not-a-status',
        'payment_status' => 'not-a-status',
        'payment_method' => 'not-a-method',
        'authorization_type' => 'not-a-type',
        'print_status' => 'not-a-status',
    ]));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/sessions/index')
        ->has('sessions.data', 1)
    );
});

test('sessions without payment voucher or print evidence remain explicitly empty', function () {
    $user = User::factory()->create();
    PhotoboothSession::factory()->create([
        'payment_method' => null,
        'voucher_id' => null,
    ]);

    $response = $this->actingAs($user)->get(route('admin.sessions.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/sessions/index')
        ->where('sessions.data.0.payment', null)
        ->where('sessions.data.0.voucherCode', null)
        ->where('sessions.data.0.printJob', null)
    );
});
