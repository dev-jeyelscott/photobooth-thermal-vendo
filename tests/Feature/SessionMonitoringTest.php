<?php

use App\Enums\PaymentStatus;
use App\Enums\PrintJobStatus;
use App\Models\Payment;
use App\Models\PhotoboothSession;
use App\Models\PrintJob;
use App\Models\User;

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
