<?php

use App\Enums\PhotoboothSessionStatus;
use App\Exceptions\InvalidPhotoboothSessionTransitionException;
use App\Models\Business;
use App\Models\CapturedMedia;
use App\Models\PhotoboothSession;
use App\Models\PhotoTemplate;
use Illuminate\Support\Str;

test('starting a session creates a business-owned photobooth session with a unique token and new status', function () {
    $business = Business::factory()->create();

    $response = $this->postJson(
        businessRoute('kiosk.sessions.store', $business),
    );

    $response->assertCreated();
    $response->assertJson([
        'status' => PhotoboothSessionStatus::New->value,
    ]);

    $session = PhotoboothSession::first();

    expect($session)
        ->not->toBeNull()
        ->and($session->business_id)
        ->toBe($business->id)
        ->and($session->session_token)
        ->toBe($response->json('sessionToken'))
        ->and($session->session_token)
        ->not->toBe((string) $session->id)
        ->and($session->status)
        ->toBe(PhotoboothSessionStatus::New)
        ->and($session->started_at)
        ->not->toBeNull()
        ->and($session->expires_at)
        ->not->toBeNull();
});

test('a session follows the allowed lifecycle transitions', function () {
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::New,
    ]);

    $session->transitionTo(PhotoboothSessionStatus::PaymentPending);

    expect($session->fresh()->status)
        ->toBe(PhotoboothSessionStatus::PaymentPending);

    $session->transitionTo(PhotoboothSessionStatus::Paid);

    expect($session->fresh()->status)
        ->toBe(PhotoboothSessionStatus::Paid);
});

test('a session rejects an invalid lifecycle transition', function () {
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::New,
    ]);

    expect(
        fn () => $session->transitionTo(
            PhotoboothSessionStatus::Capturing,
        ),
    )->toThrow(
        InvalidPhotoboothSessionTransitionException::class,
    );

    expect($session->fresh()->status)
        ->toBe(PhotoboothSessionStatus::New);
});

test('a session rejects transitioning out of a terminal status', function () {
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Completed,
    ]);

    expect(
        fn () => $session->transitionTo(
            PhotoboothSessionStatus::New,
        ),
    )->toThrow(
        InvalidPhotoboothSessionTransitionException::class,
    );
});

test('an expired session is marked expired when read', function () {
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::PaymentPending,
        'expires_at' => now()->subMinute(),
    ]);

    $this->getJson(
        kioskSessionRoute(
            'kiosk.sessions.show',
            $session,
        ),
    )->assertStatus(410);

    expect($session->fresh()->status)
        ->toBe(PhotoboothSessionStatus::Expired);
});

test('a page refresh resumes the same active session instead of duplicating it', function () {
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::PaymentPending,
    ]);

    $response = $this->getJson(
        kioskSessionRoute(
            'kiosk.sessions.show',
            $session,
        ),
    );

    $response->assertOk();
    $response->assertJson([
        'sessionToken' => $session->session_token,
        'status' => PhotoboothSessionStatus::PaymentPending->value,
    ]);

    expect(PhotoboothSession::count())->toBe(1);
});

test('resuming a session with a selected multi-slot template returns its photo slot count as the required capture count', function () {
    $template = PhotoTemplate::factory()->create([
        'photo_slots' => 5,
    ]);

    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::TemplateSelected,
        'photo_template_id' => $template->id,
        'template_snapshot' => [
            'photo_slots' => 5,
        ],
        'required_capture_count' => 3,
    ]);

    $response = $this->getJson(
        kioskSessionRoute(
            'kiosk.sessions.show',
            $session,
        ),
    );

    $response->assertOk();
    $response->assertJson([
        'requiredCaptureCount' => 5,
    ]);
});

test('resuming a session without a selected template falls back to the default required capture count', function () {
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Paid,
        'photo_template_id' => null,
        'template_snapshot' => null,
        'required_capture_count' => 3,
    ]);

    $response = $this->getJson(
        kioskSessionRoute(
            'kiosk.sessions.show',
            $session,
        ),
    );

    $response->assertOk();
    $response->assertJson([
        'requiredCaptureCount' => 3,
    ]);
});

test('resuming an unknown session token returns not found', function () {
    $business = Business::factory()->create();

    $this->getJson(
        kioskSessionRoute(
            'kiosk.sessions.show',
            (string) Str::uuid(),
            $business,
        ),
    )->assertNotFound();
});

test('a completed session remains readable so the kiosk can confirm the queued composition job gallery token', function () {
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Completed,
    ]);

    $capturedMedia = CapturedMedia::factory()
        ->for($session, 'photoboothSession')
        ->create();

    $response = $this->getJson(
        kioskSessionRoute(
            'kiosk.sessions.show',
            $session,
        ),
    );

    $response->assertOk();
    $response->assertJson([
        'status' => PhotoboothSessionStatus::Completed->value,
        'galleryToken' => $capturedMedia->public_token,
    ]);
});

test('an abandoned session is unrecoverable', function () {
    $session = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Abandoned,
    ]);

    $this->getJson(
        kioskSessionRoute(
            'kiosk.sessions.show',
            $session,
        ),
    )->assertStatus(410);
});

test('a session cannot be resumed using another session numeric id in place of its token', function () {
    $ownSession = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::New,
    ]);

    $otherSession = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::PaymentPending,
    ]);

    $this->getJson(
        kioskSessionRoute(
            'kiosk.sessions.show',
            (string) $otherSession->id,
            $ownSession->business,
        ),
    )->assertNotFound();

    expect($ownSession->fresh()->status)
        ->toBe(PhotoboothSessionStatus::New);
});

test('resuming a session with another session token does not expose the other session captured media', function () {
    $sessionA = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Completed,
    ]);

    $sessionB = PhotoboothSession::factory()->create([
        'status' => PhotoboothSessionStatus::Completed,
    ]);

    $mediaB = CapturedMedia::factory()
        ->for($sessionB, 'photoboothSession')
        ->create();

    $response = $this->getJson(
        kioskSessionRoute(
            'kiosk.sessions.show',
            $sessionA,
        ),
    );

    $response->assertOk();
    $response->assertJsonMissing([
        'galleryToken' => $mediaB->public_token,
    ]);
});
