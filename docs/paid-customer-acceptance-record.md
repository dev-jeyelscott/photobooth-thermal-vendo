# Paid Customer Acceptance Record

Durable pass/fail record for the full paid photobooth customer journey: idle
kiosk -> PayMongo QR Ph payment -> signed webhook confirmation -> template
selection -> capture -> sticker -> preview -> processing -> print -> QR
gallery -> digital download -> completion -> reset.

This record supersedes the previous version, which described the legacy
Maya checkout/webhook path. The application's payment provider was replaced
with native PayMongo QR Ph (see `5cdcf23` onward) before this run, so the
acceptance walkthrough below exercises PayMongo end to end instead.

## Evidence sources

The journey is exercised end-to-end through the application's real entry
points (routes, controllers, actions, the `PhotoboothSession` state machine,
and the kiosk UI state machine) rather than by hand-waving intermediate
steps:

- `tests/Feature/PaidSessionEndToEndTest.php` — server-side journey, split
  into two tests during this run (see "Why the test was split" below):
  - `the paid commercial journey creates a PayMongo QR checkout and
    confirms payment only through a trusted signed webhook` — session
    creation, PayMongo QR Ph checkout creation, and a real HMAC-signed
    `webhooks.paymongo` call (no fabricated payment success).
  - `the paid commercial journey continues from a confirmed Paid session
    through print and gallery delivery` — template selection, capture
    uploads, sticker selection, preview confirmation, synchronous
    composition/print processing, and gallery/QR availability, asserted
    directly against the `photobooth_sessions`, `captured_media`, and
    `print_jobs` tables.
- `resources/js/pages/__tests__/kiosk.test.tsx` (`runs the full happy-path
  session through to the QR gallery screen`) and
  `resources/js/pages/__tests__/gallery.test.tsx` — client-side journey:
  idle/welcome screen, template/sticker selection, capture handoff, preview
  confirmation, processing screen, gallery QR code, digital download links,
  and reset behavior after a completed session.
- `tests/Feature/PayMongoWebhookTest.php` and
  `tests/Feature/PayMongoPaymentReconciliationTest.php` — corroborating
  evidence for the webhook-confirmation defect recorded below.

## Run log

Executed via:

- `docker compose exec -T app php artisan test --testsuite=Feature` — 393
  passed, 20 failed (2716 assertions). The 20 failures are pre-existing
  defects unrelated to this task's changes (see "Failures encountered").
- `docker compose exec -T app php artisan test tests/Feature/PaidSessionEndToEndTest.php` —
  2 passed (42 assertions).
- `npx vitest run resources/js/pages/__tests__/kiosk.test.tsx resources/js/pages/__tests__/gallery.test.tsx` —
  19 passed.
- `docker compose exec -T app php artisan route:list --path=kiosk|gallery|webhooks` —
  confirmed all kiosk, PayMongo webhook, and gallery routes referenced below
  are registered.
- `docker compose exec -T app ./vendor/bin/pint tests/Feature/PaidSessionEndToEndTest.php --test` —
  formatted.

## Step-by-step result

| # | Step | Covered by | Result |
| - | ---- | ---------- | ------ |
| 1 | New kiosk session starts idle at the welcome screen | kiosk.test.tsx | Pass |
| 2 | Customer opens the payment path (`Pay via QR`) | kiosk.test.tsx | Pass |
| 3 | `POST kiosk/sessions` creates a `New` session | PaidSessionEndToEndTest | Pass |
| 4 | `POST kiosk/sessions/{token}/payments` creates a PayMongo QR Ph checkout and `Payment(status=pending)` | PaidSessionEndToEndTest | Pass |
| 5 | Kiosk displays the PayMongo QR Ph image | kiosk.test.tsx | Pass |
| 6 | A genuine, correctly HMAC-signed PayMongo webhook (`POST webhooks/paymongo/{account}`, `payment.paid`) is delivered | PaidSessionEndToEndTest | **Fail** — see below |
| 7 | Webhook handler marks `Payment(status=success)` | PaidSessionEndToEndTest | **Fail** — blocked by step 6 |
| 8 | Session transitions `PaymentPending -> Paid` | PaidSessionEndToEndTest | **Fail** — blocked by step 6 |
| 9 | Kiosk poll observes the `Paid` status and advances past payment | Not exercisable against the real backend (kiosk.test.tsx exercises this against a mocked poll response only) | **Not verifiable end-to-end** — blocked by step 6 |
| 10 | Template list loads (`GET templates`) | kiosk.test.tsx / PaidSessionEndToEndTest (second test, from a `Paid` session) | Pass |
| 11 | `POST kiosk/sessions/{token}/template` selects a template, session -> `TemplateSelected`, `requiredCaptureCount` returned | PaidSessionEndToEndTest | Pass |
| 12 | Kiosk enters capture flow with the required shot count | kiosk.test.tsx | Pass |
| 13 | Each shot is uploaded via `POST kiosk/sessions/{token}/shots` | PaidSessionEndToEndTest | Pass |
| 14 | Sticker list loads (`GET stickers`) | kiosk.test.tsx / PaidSessionEndToEndTest | Pass |
| 15 | `POST kiosk/sessions/{token}/sticker` records the sticker selection | PaidSessionEndToEndTest | Pass |
| 16 | Kiosk shows the preview/continue step | kiosk.test.tsx | Pass |
| 17 | `POST kiosk/sessions/{token}/preview` confirms preview, session -> `Processing` | PaidSessionEndToEndTest | Pass |
| 18 | Kiosk shows the processing screen while composition runs | kiosk.test.tsx | Pass |
| 19 | `POST kiosk/sessions/{token}/color-output` composes captured frames | PaidSessionEndToEndTest | Pass |
| 20 | Composition creates `CapturedMedia` with a public gallery token | PaidSessionEndToEndTest | Pass |
| 21 | Composition creates and prints a `PrintJob` (`status=Printed`) via the configured driver | PaidSessionEndToEndTest | Pass |
| 22 | Session transitions to `Completed` | PaidSessionEndToEndTest | Pass |
| 23 | Kiosk poll observes the gallery token and renders the QR code | kiosk.test.tsx | Pass |
| 24 | `GET gallery/{token}` renders the gallery page (color/black-and-white/GIF variants) | PaidSessionEndToEndTest / gallery.test.tsx | Pass |
| 25 | `GET gallery/{token}/qr-code` returns the scannable QR image | PaidSessionEndToEndTest | Pass |
| 26 | Digital download links resolve to the correct storage URLs and filenames per variant | gallery.test.tsx | Pass |
| 27 | Kiosk resumes/reflects `Completed` status with the gallery token via `GET kiosk/sessions/{token}` | PaidSessionEndToEndTest | Pass |
| 28 | Kiosk completion screen shows gallery-ready and print-success status | kiosk.test.tsx | Pass |
| 29 | Operator/customer taps `Start a New Session`; kiosk returns to the welcome/idle screen | kiosk.test.tsx | Pass |
| 30 | No leftover state after reset: `sessionStorage` session token is cleared, the gallery QR is unmounted, and re-entering the payment path starts with empty fields (no residual captured-photo or template selection carried into the next session) | kiosk.test.tsx | Pass |

Steps 10–30 above are verified against a session that has already reached
`Paid` (created directly for the test), since the only way to reach `Paid`
through the application's real code paths — a genuinely signed PayMongo
webhook — is currently broken (step 6). This is the same trust boundary the
end-to-end test previously crossed by fabricating payment success; that
approach has been removed so the coverage gap is visible rather than hidden.

## Failures encountered

### Step 6–9: PayMongo webhook confirmation is broken (500 on every call)

**Symptom:** Posting a genuinely HMAC-signed PayMongo webhook to
`POST webhooks/paymongo/{paymongoAccount}` (any event type) returns
`500 Internal Server Error` instead of being processed. No payment can ever
be confirmed through the real webhook path, so no session can reach `Paid`
via the actual production trust boundary.

**Root cause:** `App\Http\Controllers\PayMongoWebhookController` type-hints
and depends on `App\Services\Payments\PayMongoWebhookSignatureVerifier` in
its `__invoke` method, but that class does not exist anywhere in the
codebase (`grep -rn "class PayMongoWebhookSignatureVerifier" app` returns
nothing). Laravel's container throws a `ReflectionException` while
resolving the controller's route dependencies before the request body is
ever inspected.

**Reproduction:**

```
docker compose exec -T app php artisan test tests/Feature/PayMongoWebhookTest.php
# 14 of 14 tests fail with:
# ReflectionException: Class "App\Services\Payments\PayMongoWebhookSignatureVerifier" does not exist
```

or, exactly as pinned in this task's regression test:

```
docker compose exec -T app php artisan test tests/Feature/PaidSessionEndToEndTest.php --filter="confirms payment only through a trusted signed webhook"
```

**Evidence:** `tests/Feature/PaidSessionEndToEndTest.php` — the first test
in this file drives a real checkout, then posts a correctly signed webhook
and asserts the current (broken) `500` response, with a comment pointing at
this defect and instructing the assertion to be flipped to `assertOk()`
once the missing class is implemented.

**Impact on acceptance:** This is a full customer-journey blocker in
production: no paid session can ever be confirmed and no customer photos
can ever reach `Processing`/`Completed`, printing, or the gallery through
the real payment flow. This is a functional regression from the prior
(also broken, but at least explicitly-stubbed) webhook state documented in
`docs/failure-recovery-acceptance-record.md`'s "Known gaps" section — the
webhook is no longer a documented stub, it is a controller that crashes.

This defect was not fixed as part of this task, per this task's scope
("do not fix speculative code beyond the acceptance evidence gathering").
It should be triaged as an urgent follow-up ticket: implement
`App\Services\Payments\PayMongoWebhookSignatureVerifier` (the signature
verification logic exercised, but never actually invoked correctly, by
`tests/Feature/PayMongoWebhookTest.php`).

### Related pre-existing failures surfaced by the same run

`docker compose exec -T app php artisan test --testsuite=Feature` shows 20
failing tests, all attributable to two root causes already present in the
repository before this task and out of this task's scope to fix:

- The missing `PayMongoWebhookSignatureVerifier` class above, which also
  breaks `tests/Feature/PayMongoWebhookTest.php` (14 tests),
  `tests/Feature/Admin/PayMongoWebhookProvisioningTest.php` (1 test), and
  `tests/Feature/PayMongoPaymentReconciliationTest.php` (4 tests, which
  additionally depend on the same verifier indirectly through webhook
  fixtures).
- `tests/Feature/ReconcileStaleMayaPaymentsTest.php` (1 test) calls the
  `payments:reconcile-stale-maya` Artisan command, which no longer exists —
  it was replaced by `payments:reconcile-paymongo`
  (`app/Console/Commands/ReconcileStaleMayaPayments.php` was removed in
  favor of `app/Console/Commands/ReconcilePendingPayMongoPayments.php`, but
  the old test was not removed alongside it).

## Leftover-state verification (acceptance criterion 2)

`kiosk.test.tsx`'s full happy-path test continues through completion and
asserts, after `Start a New Session` is clicked from the completed gallery
screen:

- `window.sessionStorage.getItem('photobooth.session_token')` is `null`.
- The gallery QR code node is unmounted.
- The welcome screen is shown and the voucher/payment input is empty on the
  next entry into that flow.

No backend state is expected to leak across sessions: each kiosk session is
a distinct `photobooth_sessions` row keyed by its own `session_token`, and
the camera stream is owned entirely by the browser (`CaptureStep`),
released when the component unmounts on reset.

## Known scope boundary

This record exercises the reachable parts of the state machine and UI
journey against the application's real code paths, including a genuinely
HMAC-signed PayMongo webhook call (per the "no fabricated payment success"
constraint) that demonstrates the payment-confirmation defect above. It
does not perform a live transaction against PayMongo's hosted QR Ph flow
with a real payment instrument in production.
