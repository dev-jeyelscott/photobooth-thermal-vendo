# Laravel + React Starter Kit

## Introduction

Our React starter kit provides a robust, modern starting point for building Laravel applications with a React frontend using [Inertia](https://inertiajs.com).

Inertia allows you to build modern, single-page React applications using classic server-side routing and controllers. This lets you enjoy the frontend power of React combined with the incredible backend productivity of Laravel and lightning-fast Vite compilation.

This React starter kit utilizes React 19, TypeScript, Tailwind, and the [shadcn/ui](https://ui.shadcn.com) and [radix-ui](https://www.radix-ui.com) component libraries.

## Official Documentation

Documentation for all Laravel starter kits can be found on the [Laravel website](https://laravel.com/docs/starter-kits).

## Contributing

Thank you for considering contributing to our starter kit! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

All contributions to the Starter Kits from now on should be made through [Maestro](https://github.com/laravel/maestro).

## Code of Conduct

In order to ensure that the Laravel community is welcoming to all, please review and abide by the [Code of Conduct](https://laravel.com/docs/contributions#code-of-conduct).

## License

The Laravel + React starter kit is open-sourced software licensed under the MIT license.

## Operational Turnover

This section is the day-to-day operator's guide to the admin dashboard for
staff running the photobooth. It covers the minimum tasks needed to operate
the machine: logging in, managing templates/stickers/vouchers, setting the
session price, and monitoring transactions and prints. For hosting,
deployment, and backup procedures, see `deploy/production/README.md` instead.

### Admin login

1. Open the admin URL provided by your technical contact (for example
   `https://<your-domain>/login`).
2. Enter the admin email and password given to you at handover. Do not share
   this password; ask your technical contact to create a separate account for
   each staff member instead of sharing one login.
3. If two-factor authentication has been enabled on the account, enter the
   code from your authenticator app when prompted.
4. Use "Forgot your password?" on the login page to reset a lost password via
   email. To change your password or manage two-factor authentication while
   logged in, go to **Settings → Security**.
5. Use **Logout** (in the account menu) when you are done, especially on a
   shared computer.

### Dashboard overview

After logging in you land on **Dashboard**, which shows:

- Sessions completed today and this month, with the sales total for each.
- **Failed payments** — a running count of payments that did not succeed.
- **Failed print jobs** — a running count of prints that did not complete.

A rising "Failed payments" or "Failed print jobs" count is the first signal
that something needs attention; see [Basic troubleshooting](#basic-troubleshooting)
below.

### Template management

Go to **Templates** in the admin menu.

- **Create**: click "New template", upload the layout file and an optional
  thumbnail, set the number of photo slots and the print width/height (in
  millimeters), then save.
- **Edit**: click a template to change its name, slot count, print size, or
  replace its layout/thumbnail image.
- **Enable/disable**: use the toggle to show or hide a template from the kiosk
  without deleting it. Disabled templates are not offered to customers.
- **Delete**: only allowed for templates that have never been used in a
  session. If deletion is blocked, disable the template instead.

### Sticker management

Go to **Stickers** in the admin menu. The workflow mirrors templates:

- **Create**: upload the sticker artwork and an optional thumbnail, name it,
  and save.
- **Edit**: change the name or replace the artwork/thumbnail.
- **Enable/disable**: toggle availability on the kiosk without deleting it.
- **Delete**: only allowed for stickers that have never been used in a
  session; disable instead if deletion is blocked.

### Voucher management

Go to **Vouchers** in the admin menu.

- **Create**: click "New voucher", enter the voucher code customers will
  redeem, an optional expiration date, and how many times it may be used
  (usage limit), then save.
- **Edit**: change the code, expiration date, or usage limit.
- **Enable/disable**: toggle a voucher active/inactive without deleting it.
  Redemption attempts on an inactive, expired, or fully-used voucher are
  rejected at the kiosk.
- **Delete**: permanently removes the voucher.
- The list shows each voucher's current usage count against its usage limit,
  so you can see at a glance how much of a batch has been redeemed.

### Session price configuration

Go to **Settings** in the admin menu to configure:

- **Session price** — the amount (in pesos) charged per photobooth session.
- **Retake limit** — how many retakes a customer may take per session.
- **Session timeout** — how long (in seconds) an idle session is held before
  it expires.
- **Gallery expiration** — how many hours a customer's online gallery link
  stays available.
- **GIF frame duration** — how long (in milliseconds) each frame displays in
  the generated GIF.
- **Default printer** — the printer used for receipts.
- **Booth display name** — the name shown on the kiosk screen.

Changes take effect immediately for new sessions after saving.

### Transaction monitoring

Go to **Sessions** in the admin menu for a read-only, filterable list of
every photobooth session with its payment and print status:

- Filter by session status, and by a start/end date range, then click
  "Filter".
- Each row shows the session's status, payment method/status/amount, print
  job status and attempt count, and when the session started.
- **Identifying a payment failure**: look for a session whose payment status
  is not "success" (for example "failed"), or check the "Failed payments"
  count on the Dashboard.
- **Identifying a print failure**: look for a session whose print job status
  is "failed", or check the "Failed print jobs" count on the Dashboard.

### Print retry

The admin dashboard does not have a retry button, and it does not display the
print job's ID, so retrying a failed print requires your technical contact:

1. Find the failed session on the **Sessions** page (print job status
   "failed") and note its **session token**, shown on that row.
2. Give the session token to your technical contact. They will look up the
   associated print job's ID on the server and run
   `php artisan print-jobs:retry {printJob}` to re-queue it for another print
   attempt.
3. Refresh the **Sessions** page to confirm the print job status changed from
   "failed" to "printing" (in progress) and then "printed" (success).

### Basic troubleshooting

| Symptom | What to check | What to do |
| --- | --- | --- |
| "Failed payments" count is rising | Sessions page, filter by the affected date range and inspect the payment status/method | Confirm the payment gateway is reachable and the printer/network at the booth is online; if failures continue, contact your technical contact |
| "Failed print jobs" count is rising | Sessions page, print job column | Check the printer has paper/ribbon and is powered on and connected; ask your technical contact to run the print retry command once the printer is fixed |
| A voucher isn't being accepted at the kiosk | Vouchers page — confirm it is active, not expired, and under its usage limit | Edit the voucher to extend its expiration or usage limit, or enable it if disabled |
| A template or sticker isn't showing at the kiosk | Templates/Stickers page — confirm it is enabled (active) | Toggle it active |
| Can't log in | Confirm the email/password are correct; use "Forgot your password?" | If the account is locked or two-factor access is lost, contact your technical contact |
| Something else looks wrong on the kiosk itself | N/A | Contact your technical contact with the session token (visible on the Sessions page) so they can investigate |
