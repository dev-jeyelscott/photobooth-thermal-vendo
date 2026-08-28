# Voucher Customer Acceptance Record

Durable pass/fail record for the full voucher-authorized photobooth customer
journey: session creation -> voucher redemption (no Maya interaction) ->
template selection -> capture -> sticker -> preview -> processing -> print ->
QR gallery -> completion, plus the eligibility/rejection paths and admin
usage-accounting cross-check.

## Evidence sources

The journey is exercised end-to-end through the application's real entry
points (routes, controllers, the `RedeemVoucher` action, the
`PhotoboothSession` state machine, and the admin voucher index) rather than by
hand-waving intermediate steps:

- `tests/Feature/VoucherSessionEndToEndTest.php` — server-side happy-path
  journey: session creation, voucher redemption (`New -> Paid` with
  `payment_method = Voucher`, `price = 0.00`, zero `Payment` rows), an
  authenticated admin voucher-index check that the redeemed voucher's
  `usageCount`/`usageLimit`/`redemptions` reflect the redemption immediately,
  template selection, capture uploads, sticker selection, preview
  confirmation, synchronous composition/print processing, and gallery/QR
  availability — asserted directly against the `photobooth_sessions`,
  `vouchers`, `payments`, `captured_media`, and `print_jobs` tables, and
  confirming no request is ever sent to `paymaya.com`.
- `tests/Feature/VoucherTest.php` — redemption edge cases at the
  `kiosk.sessions.voucher.store` endpoint: expired, not-yet-valid (future
  `valid_from`), inactive, and exhausted vouchers are each rejected with
  HTTP 422 and a customer-appropriate message
  (`This voucher code is invalid or can no longer be used.`) without
  mutating `usage_count` or the session; unknown codes and expired sessions
  are rejected and logged; concurrent/duplicate redemption attempts at the
  usage-limit boundary cannot exceed `usage_limit` (atomic
  `lockForUpdate` transaction preserved, not bypassed).
- `tests/Unit/Models/VoucherEligibilityTest.php` — unit coverage of
  `Voucher::isEligible()`/`hasStarted()`/`hasExpired()`/`hasRemainingUses()`
  across active/inactive, future/past `valid_from`, expired/unexpired, and
  at-limit/under-limit states.
- `tests/Feature/VoucherManagementTest.php` and
  `VoucherIndexPresentationTest.php` — admin voucher list/detail views expose
  `usageCount`, `usageLimit`, and per-session redemption history.

All suites were run against this repository at commit `3af0517` plus the
voucher-acceptance regressions added by this task (a `notYetValid` voucher
factory state, the not-yet-valid HTTP rejection test, and the admin
usage-accounting cross-check appended to the existing end-to-end test).

## Run log

Executed via:

- `docker compose exec -T app php artisan test --filter=Voucher` — 52 passed
  (305 assertions).
- `docker compose exec -T app php artisan test --testsuite=Feature` — 356
  passed (2515 assertions).

## Step-by-step result

| # | Step | Covered by | Result |
| - | ---- | ---------- | ------ |
| 1 | `POST kiosk/sessions` creates a `New` session | VoucherSessionEndToEndTest | Pass |
| 2 | `POST kiosk/sessions/{token}/voucher` with a valid code redeems the voucher exactly once, incrementing `usage_count` by exactly 1 | VoucherSessionEndToEndTest, VoucherTest | Pass |
| 3 | Session transitions `New -> Paid` directly, with `payment_method = Voucher`, `price = 0.00`, `voucher_id` set, and zero `Payment` rows created; no request is sent to `paymaya.com` | VoucherSessionEndToEndTest | Pass |
| 4 | Admin voucher index (`GET admin/vouchers`) immediately shows the redeemed voucher's `usageCount`/`usageLimit` and lists the redeeming session in `redemptions` | VoucherSessionEndToEndTest | Pass |
| 5 | An expired voucher is rejected (422, customer-safe message), usage_count and session unchanged | VoucherTest | Pass |
| 6 | A not-yet-valid voucher (future `valid_from`) is rejected (422, customer-safe message), usage_count and session unchanged | VoucherTest | Pass |
| 7 | An exhausted voucher is rejected (422, customer-safe message), usage_count and session unchanged | VoucherTest | Pass |
| 8 | An inactive voucher is rejected (422, customer-safe message), usage_count and session unchanged | VoucherTest | Pass |
| 9 | An unknown voucher code is rejected and logged | VoucherTest | Pass |
| 10 | Concurrent redemption attempts at the usage-limit boundary cannot exceed `usage_limit` (atomic locking preserved) | VoucherTest | Pass |
| 11 | Duplicate redemption requests for the same session cannot each consume a voucher use | VoucherTest | Pass |
| 12 | Template list loads and `POST kiosk/sessions/{token}/template` selects a template, session -> `TemplateSelected`, `requiredCaptureCount` returned | VoucherSessionEndToEndTest | Pass |
| 13 | Each required shot is uploaded via `POST kiosk/sessions/{token}/shots` | VoucherSessionEndToEndTest | Pass |
| 14 | `POST kiosk/sessions/{token}/sticker` records the sticker selection | VoucherSessionEndToEndTest | Pass |
| 15 | `POST kiosk/sessions/{token}/preview` confirms preview, session -> `Processing` | VoucherSessionEndToEndTest | Pass |
| 16 | `POST kiosk/sessions/{token}/color-output` composes captured frames into `CapturedMedia` with a public gallery token | VoucherSessionEndToEndTest | Pass |
| 17 | A `PrintJob` is created and printed (`status = Printed`) via the configured driver | VoucherSessionEndToEndTest | Pass |
| 18 | Session transitions to `Completed`; voucher `usage_count` remains `1` (not incremented again) | VoucherSessionEndToEndTest | Pass |
| 19 | `GET gallery/{token}` renders the gallery page and `GET gallery/{token}/qr-code` returns the scannable QR image | VoucherSessionEndToEndTest | Pass |
| 20 | `GET kiosk/sessions/{token}` reflects `Completed` status with the gallery token | VoucherSessionEndToEndTest | Pass |

## Failures encountered

None. All 20 steps passed against the current codebase (commit `3af0517`
plus this task's regression additions).

## Known scope boundary

This record exercises the full state machine, admin usage-accounting view,
and eligibility/rejection paths against the application's real code paths,
including the atomic, lock-protected `RedeemVoucher` transaction (not
bypassed or stubbed). It does not perform manual, human-executed interaction
with the kiosk browser UI; the voucher-entry UI itself is out of scope for
this record and is exercised separately by the kiosk UI test suite referenced
in `docs/paid-customer-acceptance-record.md`.
