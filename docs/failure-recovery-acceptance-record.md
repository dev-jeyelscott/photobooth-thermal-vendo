# Failure and Recovery Acceptance Record

Durable pass/fail record for the failure and recovery scenarios listed in the
roadmap: camera denial/disconnect, network interruption, expired session,
payment failure/cancel/expiry, invalid/exhausted voucher, processing/storage/
GIF/printer failure, and gallery expiration. Each scenario is reproduced
against the application's real code paths (existing or newly added Feature/
component tests, or direct source inspection where no test gap existed to
close), and the resulting customer-facing state, operational evidence, and
recovery path are recorded below.

## Evidence sources

- `tests/Feature/PhotoboothSessionLifecycleTest.php`
- `tests/Feature/PaymentTest.php`, `tests/Feature/PaymentCheckoutQrCodeTest.php`
- `tests/Feature/VoucherTest.php`
- `tests/Feature/ProcessCapturedMediaTest.php`, `tests/Feature/GifGenerationTest.php`
- `tests/Feature/ProcessPrintJobTest.php`
- `tests/Feature/MediaExpirationTest.php`, `tests/Feature/PruneExpiredMediaTest.php`, `tests/Feature/GalleryTest.php`
- `resources/js/hooks/__tests__/use-camera.test.ts`
- `resources/js/components/__tests__/capture-step-camera-stream-lost.test.tsx`
- `resources/js/components/__tests__/capture-step-camera-recovery.test.tsx` (extended by this task with a `no-camera-permission` regression)
- `resources/js/components/__tests__/capture-step.test.tsx`
- `resources/js/pages/__tests__/kiosk.test.tsx` (extended by this task with `invalid-voucher` and `processing-failure` UI regressions)
- Direct source inspection of `app/Http/Controllers/PayMongoWebhookController.php`, `app/Http/Controllers/PaymentController.php`, `app/Jobs/ProcessPrintJob.php`, `app/Http/Controllers/GalleryController.php`, and `app/Http/Controllers/PhotoboothSessionController.php`

## Run log

Executed via:

- `docker compose exec -T app php artisan test --testsuite=Feature` — 391
  passed (2705 assertions).
- `npx vitest run` — 217 passed across 38 files, including the two extended
  suites above.
- `npx tsc --noEmit` — no type errors.
- `npx eslint .` — no lint errors.
- `npx prettier --check resources/js/pages/__tests__/kiosk.test.tsx resources/js/components/__tests__/capture-step-camera-recovery.test.tsx` — formatted.

## Step-by-step result

| # | Scenario | Customer-facing state | Operational evidence | Recovery path | Result |
| - | -------- | ---------------------- | --------------------- | -------------- | ------ |
| 1 | Camera permission denied (`NotAllowedError`/`SecurityError`) | `kiosk-error-no-camera-permission` (`CameraPreview`/`CaptureStep`); no stuck spinner | `useCamera` sets `error: 'permission-denied'` (asserted by `use-camera.test.ts`) | "Try Again" re-invokes `start()`, re-prompting for permission | Pass |
| 2 | Camera disconnect mid-capture (active track ends / device removed) | `kiosk-error-camera-stream-lost` while devices remain, or `camera-unavailable`; already-captured shots are preserved in component state | `useCamera` surfaces `error: 'disconnected'`/`'in-use'`; no shots lost across re-render | "Reconnect Camera"/"Try Again" restarts the stream and capture resumes from the same shot count; "Back to Start" offered only when no devices remain | Pass |
| 3 | Network interruption during payment polling | Polling silently resumes without re-issuing a second checkout; UI does not error on a single transient failure | No duplicate `POST .../payments` call (asserted directly) | Poll retries automatically; original checkout preserved | Pass |
| 4 | Network interruption during print-status polling (5 consecutive transient failures) | `kiosk-error-network-interruption` with retry, or (if the print job is genuinely still unresolved) explicit "still printing" feedback instead of a silent hang | Poll count and terminal state asserted; digital gallery QR remains visible from the moment it was published, before the poll failures begin | "Try Again" resumes polling from the same session | Pass |
| 5 | Expired session (inactivity) | `kiosk-error-expired-session`, no retry offered (correctly terminal), "Back to Start" clears local session storage | `GET kiosk/sessions/{token}` returns 410 and durably transitions `PhotoboothSession` to `Expired` | Customer starts a new session; no partial/duplicate session state left behind | Pass |
| 6 | Payment failure/cancellation (checkout **creation** rejected by the provider) | `POST .../payments` returns 502/503 with a customer-appropriate failure; kiosk maps this into `kiosk-error-payment-failed` when the session subsequently reports `failed`/`cancelled` | `Payment.status = Failed`, `provider_status` set (`creation_failed`/`provider_uncertain`), `failed_at` recorded — diagnosable without DB access via the admin payment monitoring view | Retry issues a new checkout attempt; duplicate-attempt protection (409) prevents double-charging races | Pass |
| 7 | Payment timeout (customer never completes an issued QR Ph checkout) | `kiosk-error-payment-timeout` after `paymentTimeoutSeconds` elapses, independent of backend confirmation | Client-side timer only; no backend record distinguishes "abandoned" from "still pending" (see gap below) | "Retry Payment" resumes polling the existing checkout without re-issuing it | Pass (with a noted evidence gap — see Known gaps) |
| 8 | Invalid/exhausted/expired/not-yet-valid/inactive voucher | 422 response with a customer-safe message; kiosk's `kiosk-error-invalid-voucher` (extended regression added by this task) keeps the customer on the voucher-entry step, ready to retry | `Log::warning` records the code and session token for each rejection reason without mutating `usage_count` or the session | "Try Another Code" clears the error and the voucher input remains available | Pass |
| 9 | Processing failure (corrupt/invalid captured image payload) | `kiosk-error-processing-failure` (extended regression added by this task covers the synchronous rejection path) with a "Try Again" retry that re-invokes composition | `Log::error('Photo processing failed.', ...)` records the session token and error; the queued job rethrows so the queue worker can retry; session remains in the pre-processing status, no partial `CapturedMedia` row is created | "Try Again" re-submits the same captured photos for composition | Pass |
| 10 | Storage failure surfaced during composition (same code path as processing/GIF failure, since color, black-and-white, and GIF composition run inside one atomic `ComposeColorPhoto` action/job) | Same as processing failure — no half-written media; the job is idempotent on retry (`handling the job twice ... produces no duplicate records`) | Same `Log::error` entry; no orphaned `CapturedMedia`/file remains on the configured media disk | Same retry path as processing failure | Pass |
| 11 | GIF generation failure | Covered by the same `ProcessCapturedMedia` failure path as #9/#10 (GIF composition runs inside the same action as color/black-and-white composition, so an invalid payload fails atomically before any variant is persisted) | Same `Log::error` entry | Same retry path | Pass |
| 12 | Printer failure (driver throws, or session not in a printable state) | Digital gallery QR is already published and remains reachable — the customer is never blocked from their photos by a print failure | `PrintJob.status = Failed`, `last_error` populated with the driver's message, `attempt_count` incremented; visible to an operator without DB access via the session/print monitoring view | `php artisan print-jobs:retry {printJob}` (also exercised via the admin print retry action) re-attempts printing and can succeed; a job that is not `Failed` is rejected, preventing a duplicate physical print | Pass |
| 13 | Gallery expiration | `GET gallery/{token}` and `GET gallery/{token}/media/{variant}` both return the expired state (404 for media, `expired: true` page prop) once `expires_at` has passed, instead of serving stale/missing files | `CapturedMedia.expires_at` is set at composition time from `photobooth.gallery_expiration_hours`; `media:prune-expired` deletes only the underlying files (verified idempotent and tolerant of an already-missing file) while preserving the DB record as durable evidence | None expected — gallery expiration is intentionally terminal; the record and its expiration timestamp remain queryable by an operator | Pass |

## Regressions added by this task

Three UI-level failure states existed in the code (`kiosk-error-state.tsx`,
`camera-preview.tsx`) but were not previously exercised by any automated
test, so this task closed those coverage gaps rather than only reading the
code:

- `resources/js/components/__tests__/capture-step-camera-recovery.test.tsx` —
  new test asserting `permission-denied` renders `kiosk-error-no-camera-permission`
  with a working "Try Again" retry.
- `resources/js/pages/__tests__/kiosk.test.tsx` — new test asserting a 422
  voucher rejection renders `kiosk-error-invalid-voucher` and "Try Another
  Code" returns to the voucher-entry step with the input available again.
- `resources/js/pages/__tests__/kiosk.test.tsx` — new test asserting a
  rejected `color-output` composition call renders `kiosk-error-processing-failure`.

No production failure-handling code was added or changed; all three states
already existed and behaved correctly once reached — they were simply
unverified until now.

## Known gaps (flagged, not patched, per task scope)

- **PayMongo QR Ph post-checkout payment failure/cancellation has no backend
  transition mechanism yet.** `PayMongoWebhookController::__invoke` is an
  acknowledged stub ("Webhook endpoint ready... until signed processing
  lands in TH-PAY-005") and no reconciliation command exists for PayMongo
  (only the now-unused `ReconcileStaleMayaPayments` for the legacy Maya
  integration, which `PaymentController` no longer calls). Concretely: once
  a QR Ph checkout is issued, if the customer's payment is declined or they
  abandon it, the `Payment` row stays `Pending` indefinitely — nothing marks
  it `Failed`/`Cancelled`. The customer is still left in a safe state
  because the kiosk's own `paymentTimeoutSeconds` client-side timer
  independently raises `kiosk-error-payment-timeout` with a working retry
  (acceptance criterion 1 and 3 are met), but acceptance criterion 2
  (operator-diagnosable durable evidence) is **not** met for this specific
  path: an operator cannot distinguish "customer abandoned the QR" from
  "payment still genuinely in flight" from the `Payment` record alone. This
  is the intentionally deferred scope of TH-PAY-005 and is out of scope for
  this task's constraints (verify and document, do not add new
  failure-handling code); it should be tracked as a follow-up ticket.
