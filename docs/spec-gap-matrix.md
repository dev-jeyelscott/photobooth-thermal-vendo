# Specification-to-Code Gap Matrix

Classifies each specification area from the roadmap overview
(`Photobooth-Thermal-Vendo-Web-System-Full-Implementation-Roadmap.md`) against the current
repository, cross-referenced against `docs/architecture-audit.md`. Classifications:
`Implemented`, `Partially Implemented`, `Stubbed`, `Missing`, `Needs Production Validation`,
`Hardware Dependent`.

## Sessions

**Partially Implemented.**

- `app/Models/PhotoboothSession.php` + `app/Enums/PhotoboothSessionStatus.php` implement the full
  `New → PaymentPending → Paid → TemplateSelected → Capturing → Customizing → Processing →
  Printing → Completed` state machine with `transitionTo()`/`canTransitionTo()`/`isTerminal()`
  guards, and the voucher shortcut and any-state escape to `Expired`/`Abandoned` are enforced
  (architecture-audit.md §2).
- Gap: `database/migrations/2026_08_18_083953_create_photobooth_sessions_table.php` has no
  price/currency/payment-method/template-snapshot columns — only `photo_template_id`,
  `sticker_design_id`, `voucher_id` foreign keys. A session's effective price and selected
  template's layout are read live from `ApplicationSetting`/`PhotoTemplate` at each step rather
  than snapshotted onto the session, so historical sessions are not immune to later price or
  template configuration changes. → Phase 1 task "Complete Session Snapshot Data" (P1-002).

## Payments

**Partially Implemented.**

- `app/Actions/Payments/CreateMayaCheckout.php` creates a Maya checkout and persists a `Pending`
  `Payment`; `app/Actions/Payments/ProcessMayaWebhook.php` matches by
  `maya_checkout_id`/`maya_payment_id`, validates amount with `bccomp`, and updates status +
  transitions the session to `Paid` inside `DB::transaction()` with `lockForUpdate()`
  (architecture-audit.md §3).
- Gap: `database/migrations/2026_08_18_083954_create_payments_table.php:20-21` defines
  `maya_payment_id`/`maya_checkout_id` as `->nullable()->index()` only — no unique constraint, so
  webhook replay/race conditions could match multiple `Payment` rows to the same Maya reference. →
  Phase 1 task covering payment reference uniqueness.
- Gap: `app/Actions/Payments/CreateMayaCheckout.php` performs the outbound `Http::post()` call and
  the subsequent `Payment::create()` without a `DB::transaction()` wrapper — no rollback path if
  the checkout succeeds but the local write fails, and no row locking against concurrent checkout
  creation for the same session. → Phase 1 task addressing missing transaction boundaries.

## Vouchers

**Implemented.**

- `app/Actions/Vouchers/RedeemVoucher.php` locks the `Voucher` row (`lockForUpdate()`), validates
  active/expiry/usage-limit inside `DB::transaction()`, increments `usage_count`, attaches
  `voucher_id`, and transitions to `Paid` (architecture-audit.md §3).
- Admin CRUD exists at `app/Http/Controllers/Admin/VoucherController.php` +
  `resources/js/pages/admin/vouchers/*.tsx`. Covered by `tests/Feature/VoucherTest.php` and
  `VoucherManagementTest.php`.

## Camera

**Hardware Dependent.**

- `resources/js/hooks/use-camera.ts` wraps the browser `MediaDevices` API (`getUserMedia`,
  device enumeration/selection); `resources/js/components/camera-preview.tsx` renders the live
  `<video>` preview and a device selector when multiple cameras are available;
  `resources/js/components/capture-step.tsx` drives the countdown/capture/review flow, grabbing
  frames onto an off-screen `<canvas>`. Behavior is standards-based (browser MediaDevices) per the
  roadmap's device-agnostic rule, but functionally depends on the physical camera/browser
  permissions of the kiosk device and cannot be verified by automated tests beyond the existing
  `resources/js/pages/__tests__/kiosk.test.tsx` mocks.

## Templates

**Implemented.**

- `app/Actions/Templates/SelectPhotoTemplate.php` attaches an active `PhotoTemplate`, requiring
  session status `Paid`. `PhotoTemplate` carries `layout_config`, `photo_slots`,
  `print_width_mm`/`print_height_mm` (migrations
  `2026_08_18_083950_create_photo_templates_table.php` +
  `2026_08_19_045149_add_layout_config_and_print_dimensions_to_photo_templates_table.php`) used by
  `ColorCompositionService`. Public listing (`GET templates`) and admin CRUD
  (`app/Http/Controllers/Admin/TemplateController.php`,
  `resources/js/pages/admin/templates/*.tsx`) both exist (architecture-audit.md §4). Covered by
  `TemplateSelectionTest.php`, `TemplateManagementTest.php`.

## Stickers

**Implemented.**

- `app/Actions/Stickers/SelectStickerDesign.php` attaches an active `StickerDesign` (requires a
  template already selected, non-terminal session, overwrite-in-place). Public listing (`GET
  stickers`) and admin CRUD (`app/Http/Controllers/Admin/StickerController.php`,
  `resources/js/pages/admin/stickers/*.tsx`, `PATCH .../toggle`) both exist
  (architecture-audit.md §4). Covered by `StickerSelectionTest.php`, `StickerManagementTest.php`.

## Media

**Partially Implemented.**

- `app/Actions/Processing/ComposeColorPhoto.php` composes color/black-and-white/GIF outputs via
  `ColorCompositionService` and `GifCompositionService`, writes them to the `public` disk, upserts
  `CapturedMedia`, and advances the session to `Processing` (architecture-audit.md §5).
- Gap: within `ComposeColorPhoto::handle()`, the media writes to `Storage::disk('public')`, the
  session `transitionTo()` calls, the `CapturedMedia` `updateOrCreate()`, and the conditional
  `CreatePrintJob::handle()` call (`app/Actions/Processing/ComposeColorPhoto.php:72-100`) all run
  outside any `DB::transaction()`. A failure partway (e.g. after color/bw/gif are written but
  before the print job is created) leaves the session and media rows inconsistent with no
  automatic rollback or retry marker. → Phase 1 task addressing missing transaction boundary in
  print-job creation from completed media.

## Gallery

**Implemented.**

- `app/Http/Controllers/GalleryController.php::show()` (lines 29-34) renders the gallery Inertia
  page with `Storage::disk('public')->url(...)` public-disk URLs (not signed/temporary URLs) for
  color/bw/gif, or an `expired` flag, gated by `CapturedMedia.expires_at` + `isExpired()`;
  route-model-binds by `public_token` (architecture-audit.md §6, which explicitly notes these are
  "not signed URLs"). Access control relies on `expires_at` gating plus the unguessable
  `public_token`, not URL signing. The roadmap overview does not mandate signed URLs for gallery
  delivery, so this is not recorded as a gap. Covered by `GalleryTest.php`,
  `MediaExpirationTest.php`.

## QR

**Implemented.**

- `app/Actions/Gallery/GenerateGalleryQrCode.php` renders an SVG QR (BaconQrCode) encoding
  `route('gallery.show', $capturedMedia)`; `GalleryController::qrCode()` streams it at `GET
  gallery/{capturedMedia:public_token}/qr-code` (architecture-audit.md §6). Covered by
  `GalleryQrCodeTest.php`.

## Printing

**Partially Implemented.**

- Contract `app/Services/Printing/PrinterDriver.php` (`send(PrintJob, string $imagePath): void`)
  with `app/Services/Printing/LocalMockPrinterDriver.php` bound via the container;
  `app/Services/Printing/ReceiptRenderer.php` renders the receipt image;
  `app/Actions/Printing/CreatePrintJob.php` creates a `Pending` `PrintJob` and dispatches
  `App\Jobs\ProcessPrintJob`, which drives `Pending/Failed → Printing → Printed/Failed`, records
  `last_error` on failure without propagating the exception (architecture-audit.md §7). Covered by
  `PrintJobCreationTest.php`, `ProcessPrintJobTest.php`, `ReceiptRendererTest.php`.
- Gap (Hardware Dependent sub-concern): only `LocalMockPrinterDriver` exists — no real thermal
  printer/printer-bridge driver is implemented yet, so end-to-end hardware printing is unverified.
- Gap (transaction boundary, same root cause as Media above): `app/Actions/Printing/CreatePrintJob.php:18-23`
  creates the `PrintJob` row and dispatches `ProcessPrintJob` without a `DB::transaction()`
  wrapper around the call site in `ComposeColorPhoto`. → Phase 1 task addressing missing
  transaction boundary in print-job creation.

## Admin

**Implemented.**

- Controllers: `DashboardController`, `SessionMonitorController`, `TemplateController`,
  `StickerController`, `VoucherController`, `SettingController` (all under
  `app/Http/Controllers/Admin/`), routed via `routes/admin.php` under `auth`+`verified`
  middleware, `admin.` name prefix, `/admin` path prefix, rendering
  `resources/js/pages/admin/*` Inertia pages (architecture-audit.md §8). Covered by
  `DashboardTest.php`, `SessionMonitoringTest.php`, `AdminNavigationTest.php`, plus the
  per-resource management tests.

## Reporting

**Stubbed.**

- `app/Http/Controllers/Admin/DashboardController.php::completedSessionStats()` computes only a
  basic today/this-month count + sales total (`Payment` sum where status `Success`) and
  failed-payment/failed-print-job counts, surfaced on `resources/js/pages/admin/dashboard.tsx`.
  There is no dedicated reporting controller, no exportable report, and no filtering beyond
  today/this-month. Covered narrowly by `SalesSummaryTest.php`.

## Settings

**Implemented.**

- `app/Http/Controllers/Admin/SettingController.php` exposes a fixed key allowlist
  (`session_price`, `retake_limit`, `session_timeout_seconds`, `gallery_expiration_hours`,
  `gif_frame_duration_ms`, `default_printer`, `booth_display_name`) backed by
  `App\Services\Settings` and the `application_settings` table
  (`database/migrations/2026_08_18_084004_create_application_settings_table.php`), rendered via
  `resources/js/pages/admin/settings/edit.tsx`. Covered by `SystemSettingsTest.php`.
- Non-admin user settings (`resources/js/pages/settings/{profile,appearance,security}.tsx`,
  `routes/settings.php`) are implemented, covered by `tests/Feature/Settings/*.php`.

## Security

**Partially Implemented.**

- Authentication/2FA/passkeys via Laravel Fortify (`config/fortify.php`, `tests/Feature/Auth/*.php`).
- Rate limiting exists narrowly (`tests/Feature/RateLimitTest.php` exercises payment/webhook
  endpoints); `app/Http/Middleware/` only contains `HandleAppearance.php` and
  `HandleInertiaRequests.php` — no custom authorization/policy middleware beyond Laravel's
  defaults and Fortify's built-ins.
- Admin routes are gated by `auth`+`verified` only (architecture-audit.md §8); there is no
  role/permission model — any verified `User` can reach `/admin`. Not yet classified against a
  specific roadmap security task pending Phase 1/later scope.

## Queues

**Implemented.**

- `config/queue.php` default connection `database` (`QUEUE_CONNECTION=database` in `.env.example`);
  `App\Jobs\ProcessPrintJob` (queued) drives the print job lifecycle
  (architecture-audit.md §7), exercised in `ProcessPrintJobTest.php`. No Redis/SQS/Beanstalkd
  connection is configured or required by current code.

## Scheduler

**Implemented.**

- `routes/console.php`: `Schedule::command('photobooth:expire-sessions')->everyMinute()` (session
  expiry) and `Schedule::command('media:prune-expired')->hourly()` (media pruning), matching
  architecture-audit.md §2 and §6.

## Deployment

**Needs Production Validation.**

- `deploy/production/README.md` documents host provisioning (Ubuntu 26.04, Nginx, PHP 8.5 FPM,
  PostgreSQL, Supervisor, Certbot) and references checked-in environment-specific configuration
  templates: `photobooth.env.example` (`DB_CONNECTION=pgsql`, `FILESYSTEM_DISK=public`,
  `QUEUE_CONNECTION=database`), `nginx.conf.example`, `supervisor-worker.conf.example` (queue
  worker for `ProcessPrintJob`), `photobooth-schedule.cron.example` (drives
  `photobooth:expire-sessions`/`media:prune-expired`), and `backup.sh`/`backup.env.example`
  (PostgreSQL `pg_dump` + media disk backup). The README also lists read-only post-deploy checks
  (`php artisan about`, `config:show database.default`/`filesystems.default`/`queue.default`,
  `schedule:list`, `route:list --except-vendor`). No `Dockerfile`/`docker-compose*` is present
  (`project_runtime_capabilities` confirms `uses_docker: false`); deployment is host-based per the
  documented runbook, not containerized. CI (`.github/workflows/tests.yml`) runs `composer setup`
  then `composer ci:check` on PHP 8.5/Node 22, targeting SQLite for tests per
  `docs/ci-baseline.md`/`composer.json`, distinct from the PostgreSQL/`public`-disk production
  target the runbook requires. The remaining gap is that this runbook and its templates have not
  been executed/validated against a live production host — no evidence in-repo of an actual
  deployment run or its post-deploy checks having been performed.

## Cross-reference: known concrete gaps (Phase 1 pointers)

| Gap | Evidence | Classification | Phase 1 task pointer |
|---|---|---|---|
| Session price/template snapshotting missing | `database/migrations/2026_08_18_083953_create_photobooth_sessions_table.php` has no price/currency/payment_method/template-snapshot columns | Missing | P1-002 "Complete Session Snapshot Data" |
| No unique constraint on payment references | `database/migrations/2026_08_18_083954_create_payments_table.php:20-21` — `maya_payment_id`/`maya_checkout_id` are `nullable()->index()`, not unique | Missing | Phase 1 payment-integrity task |
| Missing transaction boundary in `CreateMayaCheckout` | `app/Actions/Payments/CreateMayaCheckout.php` — `Http::post()` + `Payment::create()` run outside `DB::transaction()` | Partially Implemented | Phase 1 transaction-boundary task |
| Missing transaction boundary in print-job creation from completed media | `app/Actions/Processing/ComposeColorPhoto.php:72-100` (media writes, session transitions, `CapturedMedia` upsert, `CreatePrintJob::handle()`) and `app/Actions/Printing/CreatePrintJob.php:18-23` run outside `DB::transaction()` | Partially Implemented | Phase 1 transaction-boundary task |
