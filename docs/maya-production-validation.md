# Maya Production Checkout Validation Checklist

> **Manual, human-executed checklist. Not automatable in CI.**
> This checklist must be executed by an operator, by hand, against the **live Maya
> merchant account** (production `MAYA_BASE_URL`), using a physical or staged kiosk
> and a real payment instrument. It requires live credentials that must never be
> committed to this repository, and it cannot run inside automated CI pipelines
> because it depends on the operator interacting with Maya's hosted checkout page
> and, for several scenarios, on Maya's asynchronous webhook delivery.

## Prerequisites

- Deployment environment configured with **production** values for:
  - `MAYA_BASE_URL` (Maya's live API base URL, not the sandbox URL)
  - `MAYA_PUBLIC_KEY`
  - `MAYA_SECRET_KEY`
  - `MAYA_WEBHOOK_SECRET`
- These env vars must be set directly in the deployment's environment/secret store.
  Never paste their actual values into this document, commit messages, logs, or
  chat. Reference them only by name.
- Maya merchant dashboard configured with a webhook endpoint pointing at this
  application's `POST /webhooks/maya` route, signed with the same
  `MAYA_WEBHOOK_SECRET` value configured above.
- A kiosk (or kiosk-equivalent browser session) able to reach the deployed
  application and complete a real Maya-hosted checkout.
- A real payment instrument (card/wallet) usable against the live Maya account
  for at least one successful and one intentionally-declined transaction.
- Read/tail access to application logs (`Log::warning` entries from
  `App\Http\Controllers\MayaWebhookController` and
  `App\Actions\Payments\ProcessMayaWebhook`) during the run.

## How to observe state during this checklist

- **Payment record**: inspect the `payments` table row for the session
  (`status`, `maya_checkout_id`, `maya_payment_id`, `paid_at`, `failed_at`,
  `cancelled_at`, `amount`).
- **Session record**: inspect the `photobooth_sessions` row `status` column.
- **Kiosk UI**: the kiosk polls the backend session (never Maya directly) every
  `PAYMENT_POLL_INTERVAL_MS` while on the `pay-via-qr` step and reacts to the
  refreshed `paymentStatus`/`status` values (`resources/js/pages/kiosk.tsx`).

---

## Scenario 1 — Successful live transaction (checkout creation)

1. From the kiosk, start a session and proceed to payment so `CreateMayaCheckout`
   calls the live `/checkout/v1/checkouts` endpoint.
2. **Expected**: a `Payment` row is created with `status = pending`,
   `maya_checkout_id` populated, and `amount`/session `currency` matching the
   configured session price. The kiosk receives and displays the Maya-hosted
   checkout URL/QR code.
3. **Pass criteria**: checkout session created on the live Maya dashboard for the
   correct amount and currency; no duplicate `Payment` row is created if the
   kiosk reloads the same step (the `hasActivePayment` guard in
   `CreateMayaCheckout::handle` should block a second pending payment for the
   same session).

## Scenario 2 — Webhook success

1. Complete the live Maya-hosted checkout from Scenario 1 using a valid payment
   instrument to authorize the transaction.
2. Maya delivers a `PAYMENT_SUCCESS` webhook to `POST /webhooks/maya`.
3. **Expected**: `MayaWebhookController` verifies the `Maya-Webhook-Signature`
   header (HMAC-SHA256 over the raw body using `MAYA_WEBHOOK_SECRET`), then
   `ProcessMayaWebhook` updates the `Payment` to `status = success`,
   `paid_at` set, `maya_payment_id` set, and transitions the
   `PhotoboothSession` to `paid`.
4. **Pass criteria**: `payments.status = success`,
   `photobooth_sessions.status = paid`; kiosk polling detects
   `status === 'paid'` and automatically advances past the payment step (see
   Scenario 7).

## Scenario 3 — Webhook failure

1. Trigger a live Maya checkout and intentionally decline/fail the payment
   (e.g. using a payment method Maya's live gateway will reject, or abandoning
   the transaction in a way that yields a `PAYMENT_FAILED` status from Maya).
2. Maya delivers a `PAYMENT_FAILED` webhook.
3. **Expected**: `Payment.status = failed`, `failed_at` set, `paid_at` and
   `cancelled_at` remain null. The `PhotoboothSession` status is **not**
   transitioned (stays `payment_pending`).
4. **Pass criteria**: kiosk polling detects `paymentStatus === 'failed'` and
   surfaces a retry-capable error state (`payment-failed`) instead of
   proceeding.

## Scenario 4 — Webhook cancellation

1. Trigger a live Maya checkout and cancel it from Maya's hosted checkout page
   (e.g. use the cancel/back action on the Maya UI) so Maya reports
   `PAYMENT_CANCELLED`.
2. **Expected**: `Payment.status = cancelled`, `cancelled_at` set, `paid_at` and
   `failed_at` remain null. `PhotoboothSession` status is **not** transitioned.
3. **Pass criteria**: kiosk polling detects `paymentStatus === 'cancelled'` and
   surfaces the same retry-capable error state as a failure.

## Scenario 5 — Duplicate webhook idempotency check

1. After Scenario 2 completes successfully (`Payment.status = success`),
   manually resend the identical webhook payload/signature (Maya's dashboard
   may offer a "resend" action, or replay via a signed request using the same
   raw body and `Maya-Webhook-Signature`).
2. **Expected**: the endpoint still returns `200 OK`, but no new `Payment` row
   is created, `paid_at` is unchanged, and the session remains `paid` (does not
   re-transition or error). This is enforced by the row lock plus
   `if ($payment->status !== PaymentStatus::Pending) { return true; }` guard in
   `ProcessMayaWebhook::handle`.
3. **Pass criteria**: `payments` row count for the session is unchanged before
   and after the replay; `paid_at` timestamp is identical.

## Scenario 6 — Amount/currency mismatch rejection

1. This scenario validates rejection of a webhook payload whose `amount.value`
   does not match the stored `Payment.amount`. Because live Maya webhooks are
   generated by Maya from the real checkout amount, provoking a genuine
   mismatch from Maya itself is not generally possible; this check should
   instead be exercised by sending a manually crafted webhook request (signed
   with the real `MAYA_WEBHOOK_SECRET`, using a `checkoutId` for a real pending
   payment) whose `amount.value` differs from the payment's stored amount, or
   is a non-numeric string.
2. **Expected**: `POST /webhooks/maya` returns `422 Unprocessable Entity`, the
   `Payment` row is **not** mutated (stays `pending`), and a `Log::warning`
   entry ("Maya webhook amount failed validation.") is recorded.
3. **Pass criteria**: no state change to `payments` or `photobooth_sessions`;
   `422` response; warning logged.
4. **Known implementation gap — report, do not fix under this task**:
   `ProcessMayaWebhook::handle` currently validates only `amount.value`
   against `Payment.amount`. It does **not** validate `amount.currency` from
   the webhook payload against the session/payment currency at all — the
   `currency` key in the payload is read by the test fixtures but never
   compared in `app/Actions/Payments/ProcessMayaWebhook.php`. A webhook with a
   matching numeric amount but a mismatched currency (e.g. `USD` instead of
   `PHP`) would currently be **accepted**. This should be tracked as a
   follow-up task to add explicit currency comparison; it is out of scope for
   this documentation-only task.

## Scenario 7 — Kiosk automatic continuation after confirmed payment

1. With the kiosk sitting at the `pay-via-qr` step (actively polling), complete
   Scenario 2 (webhook success) out-of-band (e.g. from another device or via
   the Maya-hosted page).
2. **Expected**: within one `PAYMENT_POLL_INTERVAL_MS` interval, the kiosk's
   background poll (`resources/js/pages/kiosk.tsx`) reads the refreshed backend
   session, observes `status === 'paid'`, stops polling, clears any error
   state, and automatically advances the kiosk UI to the `select-template`
   step — with no operator or customer action required beyond completing
   payment on Maya's page.
3. **Pass criteria**: kiosk transitions off the payment screen automatically
   and without manual refresh, within the configured poll interval; no error
   banner is shown; the session timer resets as part of the transition.

---

## Sign-off

Record, for each scenario above: date/time executed, operator name/email,
environment (production), pass/fail, and any log excerpts or screenshots
(with credentials redacted) supporting the result.
