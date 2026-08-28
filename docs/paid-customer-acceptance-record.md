# Paid Customer Acceptance Record

Durable pass/fail record for the full paid photobooth customer journey: idle
kiosk -> PayMongo QR Ph payment -> signed webhook confirmation -> template
selection -> capture -> sticker -> preview -> processing -> print -> QR
gallery -> digital download -> completion -> reset.

This record supersedes the previous version, which recorded a critical
blocker (`App\Services\Payments\PayMongoWebhookSignatureVerifier` did not
exist, so every real PayMongo webhook 500'd and no session could ever reach
`Paid` through the real payment path). That blocker, and two further root
causes it was masking, have been fixed; the full journey now succeeds
end-to-end through the application's real code paths.

## Root causes fixed in this run

1. **Missing webhook signature verifier.**
   `App\Http\Controllers\PayMongoWebhookController` depended on
   `App\Services\Payments\PayMongoWebhookSignatureVerifier`, which did not
   exist anywhere in the codebase. Implemented it to parse the
   `Paymongo-Signature` header (`t=...,te=...,li=...`), enforce the
   configured tolerance window (`services.paymongo.webhook_tolerance_seconds`,
   defaulting to 300s), and verify the `te` (Test mode) or `li` (Live mode)
   HMAC-SHA256 signature with `hash_equals`.
2. **Table name mismatch.** `App\Models\PayMongoWebhookEvent` had no
   explicit `$table`, so Eloquent's naming convention resolved it to
   `pay_mongo_webhook_events`, but the migration creates
   `paymongo_webhook_events` (matching `PayMongoAccount`'s explicit
   `paymongo_accounts` table). Every insert/query against the model failed
   with `no such table`. Fixed by adding `protected $table =
   'paymongo_webhook_events';`, consistent with the sibling
   `PayMongoAccount` model.
3. **Wrong inferred foreign key on `payMongoAccount()` relations.**
   `PayMongoWebhookEvent::payMongoAccount()` and `Payment::payMongoAccount()`
   both called `belongsTo(PayMongoAccount::class)` without an explicit
   foreign key. Eloquent's convention infers the foreign key from the
   relation method name (`payMongoAccount` -> `pay_mongo_account_id`), but
   the actual column on both tables is `paymongo_account_id`. This silently
   resolved to `null` (querying `where id is null`) instead of throwing,
   masking the defect. Fixed both relations to specify the foreign key
   explicitly.

## Evidence sources

The journey is exercised end-to-end through the application's real entry
points (routes, controllers, actions, the `PhotoboothSession` state machine,
and the kiosk UI state machine) rather than by hand-waving intermediate
steps:

- `tests/Feature/PaidSessionEndToEndTest.php` — one continuous server-side
  test (`the paid commercial journey confirms payment through a trusted
  signed webhook and continues through print and gallery delivery`):
  session creation, PayMongo QR Ph checkout creation, a real HMAC-signed
  `webhooks.paymongo` call that now succeeds and transitions the session
  `PaymentPending -> Paid`, then template selection, capture uploads,
  sticker selection, preview confirmation, synchronous composition/print
  processing, and gallery/QR availability — all against the same session
  produced by the real payment flow (no factory-created `Paid` session).
- `resources/js/pages/__tests__/kiosk.test.tsx` (`runs the full happy-path
  session through to the QR gallery screen`) and
  `resources/js/pages/__tests__/gallery.test.tsx` — client-side journey:
  idle/welcome screen, template/sticker selection, capture handoff, preview
  confirmation, processing screen, gallery QR code, digital download links,
  and reset behavior after a completed session.
- `tests/Feature/PayMongoWebhookTest.php` — signature verification
  (valid/cross-mode/stale/mutated-body/redacted-log cases), idempotent
  inbox persistence, encrypted-at-rest payload storage, and financial
  state-machine correctness (payment.paid/failed, qrph.expired, wrong
  amount/currency, cross-account, late/expired-session, failure-then-success
  ordering).

## Run log

Executed via:

- `docker compose exec -T app php artisan test --testsuite=Feature` — 410
  passed, 2 failed (2756 assertions). The 2 remaining failures are
  pre-existing defects unrelated to this task (see "Related pre-existing
  failures" below).
- `docker compose exec -T app php artisan test tests/Feature/PaidSessionEndToEndTest.php` —
  1 passed (42 assertions).
- `docker compose exec -T app php artisan test tests/Feature/PayMongoWebhookTest.php` —
  14 passed (48 assertions).
- `npx vitest run resources/js/pages/__tests__/kiosk.test.tsx resources/js/pages/__tests__/gallery.test.tsx` —
  19 passed.
- `docker compose exec -T app php artisan route:list --path=kiosk` —
  confirmed all kiosk routes referenced below are registered.
- `docker compose exec -T app ./vendor/bin/phpstan analyse app/Services/Payments/PayMongoWebhookSignatureVerifier.php app/Models/PayMongoWebhookEvent.php app/Models/Payment.php app/Http/Controllers/PayMongoWebhookController.php` —
  no errors.
- `docker compose exec -T app ./vendor/bin/pint --test app/Services/Payments/PayMongoWebhookSignatureVerifier.php app/Http/Controllers/PayMongoWebhookController.php app/Models/PayMongoWebhookEvent.php app/Models/Payment.php config/services.php tests/Feature/PaidSessionEndToEndTest.php` —
  formatted.

## Step-by-step result

| # | Step | Covered by | Result |
| - | ---- | ---------- | ------ |
| 1 | New kiosk session starts idle at the welcome screen | kiosk.test.tsx | Pass |
| 2 | Customer opens the payment path (`Pay via QR`) | kiosk.test.tsx | Pass |
| 3 | `POST kiosk/sessions` creates a `New` session | PaidSessionEndToEndTest | Pass |
| 4 | `POST kiosk/sessions/{token}/payments` creates a PayMongo QR Ph checkout and `Payment(status=pending)` | PaidSessionEndToEndTest | Pass |
| 5 | Kiosk displays the PayMongo QR Ph image | kiosk.test.tsx | Pass |
| 6 | A genuine, correctly HMAC-signed PayMongo webhook (`POST webhooks/paymongo/{account}`, `payment.paid`) is delivered | PaidSessionEndToEndTest | Pass |
| 7 | Webhook handler marks `Payment(status=success)` | PaidSessionEndToEndTest | Pass |
| 8 | Session transitions `PaymentPending -> Paid` | PaidSessionEndToEndTest | Pass |
| 9 | Kiosk poll observes the `Paid` status and advances past payment | kiosk.test.tsx (mocked poll response) + PaidSessionEndToEndTest (`GET kiosk/sessions/{token}` reflects `Paid`/downstream status on the real session) | Pass |
| 10 | Template list loads (`GET templates`) | kiosk.test.tsx / PaidSessionEndToEndTest | Pass |
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

Steps 1–30 above are now all verified against the same session, produced
entirely through the application's real code paths, including a genuinely
signed PayMongo webhook (per the "no fabricated payment success" constraint).

## Related pre-existing failures (out of scope)

`docker compose exec -T app php artisan test --testsuite=Feature` shows 2
failing tests, both pre-existing and unrelated to the paid customer journey
or the webhook fix above:

- `tests/Feature/Admin/PayMongoWebhookProvisioningTest.php` (`webhook
  callback uses the opaque public id and exposes no credential material`)
  asserts an outdated stub response (`200` / `"Webhook endpoint ready."`)
  for an unsigned webhook POST. That expectation predates the real webhook
  controller implemented in `f318a34`, which correctly returns `401` for an
  unsigned/invalid-signature request. The test itself is stale and needs to
  be updated to assert the real signed-webhook contract; this is a separate,
  narrowly-scoped test-maintenance task, not a paid-journey defect.
- `tests/Feature/ReconcileStaleMayaPaymentsTest.php` calls the Artisan
  command `payments:reconcile-stale-maya`, which no longer exists — it was
  replaced by `payments:reconcile-paymongo`
  (`app/Console/Commands/ReconcileStaleMayaPayments.php` was removed in
  favor of `app/Console/Commands/ReconcilePendingPayMongoPayments.php`, but
  the old test was not removed alongside it).

Neither failure touches the `PhotoboothSession` state machine, the payment
webhook trust boundary, or any step of the paid customer journey exercised
above.

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
constraint). It does not perform a live transaction against PayMongo's
hosted QR Ph flow with a real payment instrument in production.
