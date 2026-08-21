# Architecture Audit

Factual inventory of the existing photobooth-thermal-vendo domain, so later tasks extend
existing systems instead of duplicating them. No recommendations included.

## 1. Domain models and migrations

| Model | File | Migration |
|---|---|---|
| `PhotoboothSession` | `app/Models/PhotoboothSession.php` | `database/migrations/2026_08_18_083953_create_photobooth_sessions_table.php` |
| `Payment` | `app/Models/Payment.php` | `database/migrations/2026_08_18_083954_create_payments_table.php` |
| `Voucher` | `app/Models/Voucher.php` | `database/migrations/2026_08_18_083952_create_vouchers_table.php` |
| `PhotoTemplate` | `app/Models/PhotoTemplate.php` | `database/migrations/2026_08_18_083950_create_photo_templates_table.php` (+ `2026_08_19_045149_add_layout_config_and_print_dimensions_to_photo_templates_table.php`) |
| `StickerDesign` | `app/Models/StickerDesign.php` | `database/migrations/2026_08_18_083951_create_sticker_designs_table.php` |
| `CapturedMedia` (table `captured_media`) | `app/Models/CapturedMedia.php` | `database/migrations/2026_08_18_083955_create_captured_media_table.php` (+ `2026_08_19_093616_add_public_token_to_captured_media_table.php`) |
| `PrintJob` | `app/Models/PrintJob.php` | `database/migrations/2026_08_18_083956_create_print_jobs_table.php` |
| `ApplicationSetting` | `app/Models/ApplicationSetting.php` | `database/migrations/2026_08_18_084004_create_application_settings_table.php` |
| `User` | `app/Models/User.php` | `database/migrations/0001_01_01_000000_create_users_table.php` (+ 2FA/passkey migrations) |

Relationships hang off `PhotoboothSession` (`app/Models/PhotoboothSession.php`): `belongsTo`
`PhotoTemplate`, `StickerDesign`, `Voucher`; `hasOne` `Payment`, `PrintJob`; `hasMany`
`CapturedMedia`.

## 2. PhotoboothSession state machine (reusable, must be extended not replaced)

- Model: `app/Models/PhotoboothSession.php` — `transitionTo()`, `isExpired()`, `expireIfPast()`.
- Enum: `app/Enums/PhotoboothSessionStatus.php` — states `New → PaymentPending → Paid →
  TemplateSelected → Capturing → Customizing → Processing → Printing → Completed`, plus terminal
  `Expired`/`Abandoned`. `next()`/`canTransitionTo()`/`isTerminal()` encode the only allowed
  transitions, including the voucher shortcut `New → Paid`. `canTransitionTo()` first rejects any
  transition when the current status is terminal (`Completed`/`Expired`/`Abandoned`); otherwise a
  non-terminal session may transition to `Expired`/`Abandoned` at any point.
- Session-mutating Actions `RedeemVoucher`, `SelectPhotoTemplate`, `ConfirmSessionPreview`,
  `ComposeColorPhoto`, and `SelectStickerDesign` call `expireIfPast()` first and then
  `transitionTo()`/`canTransitionTo()` rather than writing `status` directly.
  `ProcessMayaWebhook` does not call `expireIfPast()`; it locks the `Payment` row, and on a
  success status calls `canTransitionTo(Paid)` directly on the session's current status before
  `transitionTo(Paid)`.
- Scheduled command `photobooth:expire-sessions` (registered in `routes/console.php`, runs every
  minute) expires stale sessions.

## 3. Maya payment / voucher domain

- `app/Actions/Payments/CreateMayaCheckout.php` — creates a Maya checkout via `Http`, persists a
  `Pending` `Payment` (price read from `ApplicationSetting` key `session_price`).
- `app/Actions/Payments/ProcessMayaWebhook.php` — matches webhook payload to a `Payment` by
  `maya_checkout_id`/`maya_payment_id`, validates amount with `bccomp`, and under a DB transaction
  with `lockForUpdate()` updates `Payment.status` and transitions the session to `Paid` on success.
- `app/Http/Controllers/PaymentController.php` and `app/Http/Controllers/MayaWebhookController.php`
  expose these via `POST kiosk/sessions/{sessionToken}/payments` and `POST webhooks/maya`
  (`routes/web.php`).
- `app/Actions/Vouchers/RedeemVoucher.php` — locks the `Voucher` row, validates active/expiry/usage
  limit, increments `usage_count`, attaches `voucher_id` to the session, transitions to `Paid`.
  Exposed via `app/Http/Controllers/VoucherController.php` at
  `POST kiosk/sessions/{sessionToken}/voucher`.
- Enums: `app/Enums/PaymentMethod.php`, `app/Enums/PaymentStatus.php`.
- Admin voucher CRUD: `app/Http/Controllers/Admin/VoucherController.php` →
  `resources/js/pages/admin/vouchers/{index,create,edit,voucher-form}.tsx`.

## 4. Template / sticker domain

- `app/Actions/Templates/SelectPhotoTemplate.php` — attaches an active `PhotoTemplate`, requires
  session status `Paid` (via `canTransitionTo(TemplateSelected)`).
- `app/Actions/Stickers/SelectStickerDesign.php` — attaches an active `StickerDesign`, requires a
  template already selected and a non-terminal session; overwrite-in-place (no duplicate rows).
- Public listing controllers: `app/Http/Controllers/PhotoTemplateController.php`
  (`GET templates`), `app/Http/Controllers/StickerDesignController.php` (`GET stickers`), plus
  their per-session `store` endpoints in `routes/web.php`.
- Admin CRUD + active-toggle: `app/Http/Controllers/Admin/TemplateController.php` and
  `app/Http/Controllers/Admin/StickerController.php` (`PATCH .../toggle`), pages under
  `resources/js/pages/admin/templates/*.tsx` and `resources/js/pages/admin/stickers/*.tsx`.
- `PhotoTemplate` carries `layout_config`, `photo_slots`, `print_width_mm`/`print_height_mm` used
  by composition; both models use an `active()` query scope (`Illuminate\Database\Eloquent\
  Attributes\Scope`).

## 5. Color / B&W / GIF processing services and jobs

- `app/Actions/Preview/ConfirmSessionPreview.php` — advances a session from
  TemplateSelected/Capturing/Customizing up to `Processing` (no image work).
- `app/Actions/Processing/ComposeColorPhoto.php` — orchestrates the final composition: calls
  `ColorCompositionService::compose()`/`toBlackAndWhite()` (`app/Services/
  ColorCompositionService.php`) and `GifCompositionService::compose()`
  (`app/Services/GifCompositionService.php`), writes `captures/{token}-color.jpg`,
  `-bw.jpg`, `-animation.gif` to the `public` disk, advances the session to `Processing`, upserts
  `CapturedMedia`, and — if no `PrintJob` exists yet — calls `CreatePrintJob`.
- Exposed via `app/Http/Controllers/ColorCompositionController.php`
  (`POST kiosk/sessions/{sessionToken}/color-output`) and
  `app/Http/Controllers/PreviewController.php` (`POST kiosk/sessions/{sessionToken}/preview`).
- Config: `config/photobooth.php` (`gif_frame_duration_seconds`, `gallery_expiration_hours`,
  capture/kiosk/payment timeouts).

## 6. Gallery / QR delivery

- `app/Actions/Gallery/GenerateGalleryQrCode.php` — renders an SVG QR (BaconQrCode) encoding
  `route('gallery.show', $capturedMedia)`.
- `app/Http/Controllers/GalleryController.php` — `show()` renders Inertia page `gallery`
  (`resources/js/pages/gallery.tsx`) with `Storage::disk('public')->url(...)` URLs for
  color/bw/gif (not signed URLs), or an `expired` flag; `qrCode()` streams the SVG. Access control
  relies on `CapturedMedia.expires_at`/`isExpired()` and route-model binding by the unguessable
  `public_token`, not URL signing.
- Routes: `GET gallery/{capturedMedia:public_token}` and
  `GET gallery/{capturedMedia:public_token}/qr-code` (`routes/web.php`). `CapturedMedia` binds by
  `public_token` (`getRouteKeyName()`), not the internal id.
- `CapturedMedia.expires_at` + `isExpired()` gate access; pruning handled by the scheduled command
  `media:prune-expired` (`routes/console.php`, hourly).

## 7. PrinterDriver and print job lifecycle (reusable, must be extended not replaced)

- Contract: `app/Services/Printing/PrinterDriver.php` — `send(PrintJob $job, string
  $imagePath): void`. Only current implementation: `app/Services/Printing/
  LocalMockPrinterDriver.php` (logs instead of talking to hardware); bound via the container so a
  real hardware driver can be swapped in without touching callers.
- `app/Services/Printing/ReceiptRenderer.php` — renders the receipt image from `CapturedMedia`
  for printing.
- `app/Actions/Printing/CreatePrintJob.php` — creates a `Pending` `PrintJob`
  (`app/Enums/PrintJobStatus.php`) and dispatches `App\Jobs\ProcessPrintJob`.
- `app/Jobs/ProcessPrintJob.php` (queued job) — drives
  `Pending/Failed → Printing → Printed/Failed`: updates status/attempt_count, resolves
  `CapturedMedia`, renders the receipt via `ReceiptRenderer`, calls the injected `PrinterDriver`,
  and records `last_error` on failure without propagating the exception to the customer flow.

## 8. Admin controllers / Inertia pages

| Controller | Pages |
|---|---|
| `app/Http/Controllers/Admin/DashboardController.php` | `resources/js/pages/admin/dashboard.tsx` |
| `app/Http/Controllers/Admin/SessionMonitorController.php` | `resources/js/pages/admin/sessions/index.tsx` |
| `app/Http/Controllers/Admin/TemplateController.php` | `resources/js/pages/admin/templates/{index,create,edit,template-form}.tsx` |
| `app/Http/Controllers/Admin/StickerController.php` | `resources/js/pages/admin/stickers/{index,create,edit,sticker-form}.tsx` |
| `app/Http/Controllers/Admin/VoucherController.php` | `resources/js/pages/admin/vouchers/{index,create,edit,voucher-form}.tsx` |
| `app/Http/Controllers/Admin/SettingController.php` | `resources/js/pages/admin/settings/edit.tsx` |

All admin routes are grouped under `auth`+`verified` middleware, `admin.` name prefix, `/admin`
path prefix (`routes/admin.php`). Non-admin Inertia routes (`welcome`, `kiosk`, settings/profile,
settings/security, settings/appearance, auth pages) are in `routes/web.php` and
`routes/settings.php`, rendered from `resources/js/pages/{welcome,kiosk}.tsx`,
`resources/js/pages/settings/*.tsx`, `resources/js/pages/auth/*.tsx`.

Kiosk session lifecycle controller: `app/Http/Controllers/PhotoboothSessionController.php`
(`POST kiosk/sessions`, `GET kiosk/sessions/{sessionToken}`).

## 9. Test suite coverage per feature area (`tests/Feature`)

| Area | Test file(s) |
|---|---|
| Session lifecycle / state machine | `PhotoboothSessionLifecycleTest.php`, `DomainModelsTest.php` |
| Payments | `PaymentTest.php`, `MayaWebhookTest.php`, `RateLimitTest.php` |
| Vouchers | `VoucherTest.php`, `VoucherManagementTest.php` |
| Templates | `TemplateSelectionTest.php`, `TemplateManagementTest.php` |
| Stickers | `StickerSelectionTest.php`, `StickerManagementTest.php` |
| Preview confirmation | `PreviewConfirmationTest.php` |
| Color/B&W/GIF composition | `ColorCompositionTest.php`, `BlackAndWhiteCompositionTest.php`, `GifGenerationTest.php` |
| Printing | `PrintJobCreationTest.php`, `ProcessPrintJobTest.php`, `ReceiptRendererTest.php` |
| Gallery / QR | `GalleryTest.php`, `GalleryQrCodeTest.php`, `MediaExpirationTest.php` |
| Admin dashboard / sales / sessions monitor | `DashboardTest.php`, `SalesSummaryTest.php`, `SessionMonitoringTest.php`, `AdminNavigationTest.php` |
| System settings | `SystemSettingsTest.php` |
| Kiosk | `KioskTest.php`, `resources/js/pages/__tests__/kiosk.test.tsx` |
| Auth / Fortify | `tests/Feature/Auth/*.php` |
| Profile/security settings | `tests/Feature/Settings/*.php` |
| Admin layout (frontend) | `resources/js/pages/admin/__tests__/layout.test.ts` |

## 10. Test / lint / CI command baseline

- PHP: `composer test` runs `artisan config:clear` → `lint:check` (Pint `--test`) →
  `types:check` (`phpstan analyse`, i.e. Larastan) → `artisan test` (Pest). Defined in
  `composer.json` `scripts`.
- Full CI gate: `composer ci:check` runs `npm run lint:check` (ESLint), `npm run format:check`
  (Prettier), `npm run types:check` (`tsc --noEmit`), then `composer test` (transitively).
- JS: `package.json` `scripts` — `lint`/`lint:check` (ESLint), `format`/`format:check`
  (Prettier), `types:check` (TypeScript), `test` (Vitest).
- CI workflow: `.github/workflows/tests.yml` — on push to `main` and on PRs, runs
  `composer setup` then `composer ci:check` (PHP 8.5, Node 22).
