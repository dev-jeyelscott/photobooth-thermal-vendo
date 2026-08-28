# Paid Customer Acceptance Record

Durable pass/fail record for the full paid photobooth customer journey: idle
kiosk -> Maya payment -> webhook confirmation -> template selection -> capture
-> sticker -> preview -> processing -> print -> QR gallery -> digital
download -> completion -> reset.

## Evidence sources

The journey is exercised end-to-end through the application's real entry
points (routes, controllers, actions, the `PhotoboothSession` state machine,
and the kiosk UI state machine) rather than by hand-waving intermediate
steps. Two automated suites together cover every step below:

- `tests/Feature/PaidSessionEndToEndTest.php` — server-side journey: session
  creation, Maya checkout creation, a real HMAC-signed `webhooks.maya` call
  (no fabricated payment success), template selection, capture uploads,
  sticker selection, preview confirmation, synchronous composition/print
  processing, and gallery/QR availability, asserted directly against the
  `photobooth_sessions`, `payments`, `captured_media`, and `print_jobs`
  tables.
- `resources/js/pages/__tests__/kiosk.test.tsx` (`runs the full happy-path
  session through to the QR gallery screen`) and
  `resources/js/pages/__tests__/gallery.test.tsx` — client-side journey:
  idle/welcome screen, template/sticker selection, capture handoff, preview
  confirmation, processing screen, gallery QR code, digital download links,
  and (extended in this task) reset behavior after a completed session.

Both suites were run against this repository at commit `5c1a60e` (base) plus
the reset-after-completion regression added by this task.

## Run log

Executed via:

- `docker compose exec -T app php artisan test --testsuite=Feature` — 355
  passed (2494 assertions), including `PaidSessionEndToEndTest`.
- `npx vitest run resources/js/pages/__tests__/kiosk.test.tsx` — 12 passed.
- `npx vitest run resources/js/pages/__tests__/gallery.test.tsx` — 5 passed.
- `docker compose exec -T app php artisan route:list` — confirmed all kiosk,
  webhook, and gallery routes referenced below are registered.

## Step-by-step result

| # | Step | Covered by | Result |
| - | ---- | ---------- | ------ |
| 1 | New kiosk session starts idle at the welcome screen | kiosk.test.tsx | Pass |
| 2 | Customer opens the payment path (`Pay via QR`) | kiosk.test.tsx | Pass |
| 3 | `POST kiosk/sessions` creates a `New` session | PaidSessionEndToEndTest | Pass |
| 4 | `POST kiosk/sessions/{token}/payments` creates a Maya checkout and `Payment(status=pending)` | PaidSessionEndToEndTest | Pass |
| 5 | Kiosk displays the Maya-hosted checkout URL/QR | kiosk.test.tsx | Pass |
| 6 | Maya webhook (`POST webhooks/maya`), HMAC-signed, delivers `PAYMENT_SUCCESS` | PaidSessionEndToEndTest | Pass |
| 7 | Webhook handler marks `Payment(status=success)` | PaidSessionEndToEndTest | Pass |
| 8 | Session transitions `New -> Paid` | PaidSessionEndToEndTest | Pass |
| 9 | Kiosk poll observes the `Paid` status and advances past payment | kiosk.test.tsx | Pass |
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
| 29 | Operator/customer taps `Start a New Session`; kiosk returns to the welcome/idle screen | kiosk.test.tsx (extended) | Pass |
| 30 | No leftover state after reset: `sessionStorage` session token is cleared, the gallery QR is unmounted, and re-entering the voucher/payment path starts with empty fields (no residual captured-photo or template selection carried into the next session) | kiosk.test.tsx (extended) | Pass |

## Leftover-state verification (acceptance criterion 2)

Step 30 was previously only exercised from an early (voucher-entry) step. This
task extended `kiosk.test.tsx`'s full happy-path test to continue through
completion and assert, after `Start a New Session` is clicked from the
completed gallery screen:

- `window.sessionStorage.getItem('photobooth.session_token')` is `null`.
- The gallery QR code node is unmounted.
- The welcome screen is shown and the voucher input is empty on the next
  entry into that flow.

No backend state is expected to leak across sessions: each kiosk session is a
distinct `photobooth_sessions` row keyed by its own `session_token`, and the
camera stream is owned entirely by the browser (`CaptureStep`), released when
the component unmounts on reset.

## Failures encountered

None. All 30 steps passed against the current codebase (commit `5c1a60e` plus
this task's regression addition).

## Known scope boundary

This record exercises the full state machine and UI journey against the
application's real code paths, including a genuinely HMAC-signed Maya
webhook call (per the "no fabricated payment success" constraint). It does
not itself perform a live transaction against Maya's hosted checkout UI with
a real payment instrument — that is covered separately by the manual,
human-executed `docs/maya-production-validation.md` checklist, which must be
run against production Maya credentials outside of CI.
