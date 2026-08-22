<?php

use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\PrintJobStatus;
use App\Models\Payment;
use App\Models\PhotoboothSession;
use App\Models\PrintJob;
use App\Models\User;
use App\Models\Voucher;

test('session monitoring requires authentication', function () {
    $this->get(route('admin.sessions.index'))->assertRedirect(route('login'));
});

test('admin can view a paginated list of sessions with payment and print job details', function () {
    $user = User::factory()->create();
    $session = PhotoboothSession::factory()->create();
    $payment = Payment::factory()->for($session, 'photoboothSession')->success()->create();
    $printJob = PrintJob::factory()->for($session, 'photoboothSession')->printed()->create();

    $response = $this->actingAs($user)->get(route('admin.sessions.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/sessions/index')
        ->where('sessions.data.0.sessionToken', $session->session_token)
        ->where('sessions.data.0.status', $session->status->value)
        ->where('sessions.data.0.payment.method', $payment->method->value)
        ->where('sessions.data.0.payment.status', PaymentStatus::Success->value)
        ->where('sessions.data.0.printJob.status', PrintJobStatus::Printed->value)
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
    $other = PhotoboothSession::factory()->create();

    $response = $this->actingAs($user)->get(route('admin.sessions.index', ['authorization_type' => 'voucher']));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/sessions/index')
        ->has('sessions.data', 1)
        ->where('sessions.data.0.sessionToken', $matching->session_token)
    );
});

test('admin can filter sessions by payment authorization type', function () {
    $user = User::factory()->create();
    $matching = PhotoboothSession::factory()->create();
    Payment::factory()->for($matching, 'photoboothSession')->create();
    $other = PhotoboothSession::factory()->create();

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

test('invalid filter values are ignored', function () {
    $user = User::factory()->create();
    PhotoboothSession::factory()->create();

    $response = $this->actingAs($user)->get(route('admin.sessions.index', [
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

test('sessions without a payment or print job display as none', function () {
    $user = User::factory()->create();
    $session = PhotoboothSession::factory()->create();

    $response = $this->actingAs($user)->get(route('admin.sessions.index'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('admin/sessions/index')
        ->where('sessions.data.0.payment', null)
        ->where('sessions.data.0.printJob', null)
    );
});
