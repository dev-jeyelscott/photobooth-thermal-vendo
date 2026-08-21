# Architecture Audit

Factual snapshot of the existing photobooth thermal vendo codebase, to prevent later tasks from
duplicating domain systems that already exist. Laravel 12 + Inertia (React/TypeScript) app.

## 1. Domain models and migrations

| Model                | File                                | Migration                                                                                                                                                            |
| -------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PhotoboothSession`  | `app/Models/PhotoboothSession.php`  | `database/migrations/2026_08_18_083953_create_photobooth_sessions_table.php`                                                                                         |
| `Payment`            | `app/Models/Payment.php`            | `database/migrations/2026_08_18_083955_create_payments_table.php`                                                                                                    |
| `Voucher`            | `app/Models/Voucher.php`            | `database/migrations/2026_08_18_083952_create_vouchers_table.php`                                                                                                    |
| `PhotoTemplate`      | `app/Models/PhotoTemplate.php`      | `database/migrations/2026_08_18_083950_create_photo_templates_table.php` (+ `2026_08_19_045149_add_layout_config_and_print_dimensions_to_photo_templates_table.php`) |
| `StickerDesign`      | `app/Models/StickerDesign.php`      | `database/migrations/2026_08_18_083951_create_sticker_designs_table.php`                                                                                             |
| `CapturedMedia`      | `app/Models/CapturedMedia.php`      | `database/migrations/2026_08_18_083956_create_captured_media_table.php` (+ `2026_08_19_093616_add_public_token_to_captured_media_table.php`)                         |
| `PrintJob`           | `app/Models/PrintJob.php`           | `database/migrations/2026_08_18_083956_create_print_jobs_table.php`                                                                                                  |
| `ApplicationSetting` | `app/Models/ApplicationSetting.php` | `database/migrations/2026_08_18_084004_create_application_settings_table.php`                                                                                        |
| `User`               | `app/Models/User.php`               | `database/migrations/0001_01_01_000000_create_users_table.php` (+ 2FA/passkey migrations)                                                                            |

Relationships: `PhotoboothSession` belongsTo `PhotoTemplate`, `StickerDesign`, `Voucher`; hasOne
`Payment`, hasOne `PrintJob`; hasMany `CapturedMedia`. `CapturedMedia` route-binds on
`public_token` (auto-generated random 32-char string) instead of the numeric id.

## 2. PhotoboothSession state machine (reusable — extend, do not replace)

`app/Models/PhotoboothSession.php` + `app/Enums/PhotoboothSessionStatus.php`.

- Linear lifecycle: `New → PaymentPending → Paid → TemplateSelected → Capturing → Customizing →
Processing → Printing → Completed`, with terminal side-exits to `Expired` / `Abandoned` from any
  non-terminal state.
- `PhotoboothSessionStatus::next()` returns the single legal next status; `canTransitionTo()`
  enforces the rule (plus a special case: `New → Paid` directly, for voucher redemption bypassing
  Maya payment-pending).
- `PhotoboothSession::transitionTo()` throws `InvalidPhotoboothSessionTransitionException` on an
  illegal move; `expireIfPast()` / `isExpired()` handle lazy expiry checks used by nearly every
  Action before mutating a session.
- All session Actions (`SelectPhotoTemplate`, `SelectStickerDesign`, `ConfirmSessionPreview`,
  `ComposeColorPhoto`, `RedeemVoucher`, `ProcessMayaWebhook`) call `expireIfPast()` and
  `canTransitionTo()`/`transitionTo()` rather than mutating `status` directly.

## 3. Maya payment / voucher domain

- `app/Actions/Payments/CreateMayaCheckout.php` — creates a Maya checkout session via
  `Http::baseUrl(config('services.maya.base_url'))`, persists a `Payment` (method `Maya`, status
  `Pending`), reads price from `ApplicationSetting` key `session_price`.
- `app/Actions/Payments/ProcessMayaWebhook.php` — maps Maya webhook statuses
  (`PAYMENT_SUCCESS`/`FAILED`/`CANCELLED`/`EXPIRED`) to `PaymentStatus`, matches by
  `maya_checkout_id`/`maya_payment_id`, verifies amount via `bccomp`, locks the `Payment` row
  (`lockForUpdate`) inside a `DB::transaction`, and on success transitions the session to `Paid`.
- `app/Http/Controllers/PaymentController.php` — kiosk-side checkout creation endpoint.
- `app/Http/Controllers/MayaWebhookController.php` — webhook receiver, `routes/web.php:
POST webhooks/maya`.
- `app/Actions/Vouchers/RedeemVoucher.php` — locks the `Voucher` row, validates active/expiry/usage
  limit, increments `usage_count`, attaches `voucher_id` to the session, transitions to `Paid`.
- `app/Http/Controllers/VoucherController.php` (kiosk redemption) vs.
  `app/Http/Controllers/Admin/VoucherController.php` (CRUD/admin management) — two distinct
  controllers, do not conflate.
- Enums: `app/Enums/PaymentMethod.php`, `app/Enums/PaymentStatus.php`.

## 4. Template / sticker domain

- `app/Actions/Templates/SelectPhotoTemplate.php` — attaches an active `PhotoTemplate`, requires
  session in `Paid`, transitions to `TemplateSelected`.
- `app/Actions/Stickers/SelectStickerDesign.php` — attaches an active `StickerDesign`, requires a
  template already selected and a non-terminal session; re-selection updates in place.
- Public listing controllers: `app/Http/Controllers/PhotoTemplateController.php`,
  `app/Http/Controllers/StickerDesignController.php`.
- Admin CRUD controllers: `app/Http/Controllers/Admin/TemplateController.php`,
  `app/Http/Controllers/Admin/StickerController.php` (both include a `toggle` action for
  active/inactive, routed via `routes/admin.php`).
- `PhotoTemplate` carries `layout_config` (array), `photo_slots`, `print_width_mm`/`print_height_mm`
  used by composition.

## 5. Color / B&W / GIF processing

- `app/Actions/Preview/ConfirmSessionPreview.php` — advances a session from
  Template Selected/Capturing/Customizing up to `Processing` without doing image work.
- `app/Actions/Processing/ComposeColorPhoto.php` (reusable — extend, do not replace) — the single
  entry point that composes captured shots into: `captures/{token}-color.jpg`,
  `captures/{token}-bw.jpg` (via `ColorCompositionService::toBlackAndWhite`), and
  `captures/{token}-animation.gif` (via `GifCompositionService`), writes to the `public` disk,
  advances the session to `Processing`, upserts a `CapturedMedia` row, and lazily creates the
  `PrintJob` if one doesn't already exist.
- `app/Services/ColorCompositionService.php` — composes photos onto the template layout
  (Intervention Image), applies sticker overlay, produces grayscale derivative.
- `app/Services/GifCompositionService.php` — builds the animated GIF from raw shots.
- `app/Http/Controllers/ColorCompositionController.php` — kiosk endpoint invoking
  `ComposeColorPhoto`.
- Tests: `tests/Feature/ColorCompositionTest.php`, `tests/Feature/BlackAndWhiteCompositionTest.php`,
  `tests/Feature/GifGenerationTest.php`, `tests/Feature/PreviewConfirmationTest.php`.

## 6. Gallery / QR delivery

- `app/Actions/Gallery/GenerateGalleryQrCode.php` — renders an SVG QR code (BaconQrCode) encoding
  `route('gallery.show', $capturedMedia)`.
- `app/Http/Controllers/GalleryController.php` — `show` (public gallery page, Inertia
  `resources/js/pages/gallery.tsx`) and `qrCode` actions, both keyed by `CapturedMedia`'s
  `public_token` route binding.
- Routes: `GET gallery/{capturedMedia:public_token}` (`gallery.show`),
  `GET gallery/{capturedMedia:public_token}/qr-code` (`gallery.qr-code`) in `routes/web.php`.
- `CapturedMedia::isExpired()` / `expires_at` (set from `config('photobooth.gallery_expiration_hours')`
  in `ComposeColorPhoto`) drive gallery/media expiration; pruning via `media:prune-expired` console
  command scheduled hourly in `routes/console.php`.
- Tests: `tests/Feature/GalleryTest.php`, `tests/Feature/GalleryQrCodeTest.php`,
  `tests/Feature/MediaExpirationTest.php`.

## 7. PrinterDriver and print job lifecycle (reusable — extend, do not replace)

- `app/Services/Printing/PrinterDriver.php` — printer-agnostic contract: `send(PrintJob $job,
string $imagePath): void`.
- `app/Services/Printing/LocalMockPrinterDriver.php` — default/dev implementation.
- Bound in `app/Providers/AppServiceProvider.php`: `PrinterDriver::class` resolves to
  `config("photobooth.printer_drivers.{$driverKey}", LocalMockPrinterDriver::class)`, so new
  hardware drivers are added by implementing the interface and registering a config key, not by
  replacing the abstraction.
- `app/Services/Printing/ReceiptRenderer.php` — renders the printable receipt image from
  `CapturedMedia`.
- `app/Actions/Printing/CreatePrintJob.php` — creates a `Pending` `PrintJob` for a session and
  dispatches `ProcessPrintJob`.
- `app/Jobs/ProcessPrintJob.php` (reusable — extend, do not replace) — queued job driving
  `Pending/Failed → Printing → Printed/Failed`; renders the receipt, calls `PrinterDriver::send()`,
  and contains any adapter failure inside the `PrintJob` record (`last_error`) instead of
  surfacing it to the customer session flow.
- Enum: `app/Enums/PrintJobStatus.php`.
- Tests: `tests/Feature/PrintJobCreationTest.php`, `tests/Feature/ProcessPrintJobTest.php`,
  `tests/Feature/ReceiptRendererTest.php`.

## 8. Admin controllers / Inertia pages

Admin routes are grouped under `auth`+`verified` middleware, prefix `admin`, name prefix `admin.`
in `routes/admin.php`.

| Controller                                     | Page(s)                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| `Admin/DashboardController`                    | `resources/js/pages/admin/dashboard.tsx`                                   |
| `Admin/SessionMonitorController`               | `resources/js/pages/admin/sessions/index.tsx`                              |
| `Admin/SettingController`                      | `resources/js/pages/admin/settings/edit.tsx`                               |
| `Admin/TemplateController` (resource + toggle) | `resources/js/pages/admin/templates/{index,create,edit,template-form}.tsx` |
| `Admin/StickerController` (resource + toggle)  | `resources/js/pages/admin/stickers/{index,create,edit,sticker-form}.tsx`   |
| `Admin/VoucherController` (resource + toggle)  | `resources/js/pages/admin/vouchers/{index,create,edit,voucher-form}.tsx`   |

Kiosk-facing pages: `resources/js/pages/kiosk.tsx` (main kiosk flow),
`resources/js/pages/gallery.tsx`, `resources/js/pages/welcome.tsx`.
Auth/settings pages under `resources/js/pages/auth/*` and `resources/js/pages/settings/*`
(Fortify-based, `app/Actions/Fortify/*`).

## 9. Test suite coverage by feature area

All in `tests/Feature/` (Pest), plus `tests/Unit/ExampleTest.php` and one JS test dir.

- **Session lifecycle**: `PhotoboothSessionLifecycleTest.php`, `KioskTest.php`
- **Payments**: `PaymentTest.php`, `MayaWebhookTest.php`
- **Vouchers**: `VoucherTest.php`, `VoucherManagementTest.php` (admin)
- **Templates**: `TemplateSelectionTest.php`, `TemplateManagementTest.php` (admin)
- **Stickers**: `StickerSelectionTest.php`, `StickerManagementTest.php` (admin)
- **Preview/processing**: `PreviewConfirmationTest.php`, `ColorCompositionTest.php`,
  `BlackAndWhiteCompositionTest.php`, `GifGenerationTest.php`
- **Printing**: `PrintJobCreationTest.php`, `ProcessPrintJobTest.php`, `ReceiptRendererTest.php`
- **Gallery**: `GalleryTest.php`, `GalleryQrCodeTest.php`, `MediaExpirationTest.php`
- **Admin/general**: `DashboardTest.php`, `SessionMonitoringTest.php`, `SystemSettingsTest.php`,
  `SalesSummaryTest.php`, `AdminNavigationTest.php`, `DomainModelsTest.php`, `RateLimitTest.php`
- **Auth**: `tests/Feature/Auth/*`, `tests/Feature/Settings/*`
- **Frontend**: `resources/js/pages/__tests__/kiosk.test.tsx`,
  `resources/js/pages/admin/__tests__/layout.test.ts` (Vitest)

## 10. Test / lint / CI command baseline

- **`composer.json` `scripts`**:
    - `lint` / `lint:check` → Pint (`pint --parallel[--test]`)
    - `types:check` → PHPStan/Larastan (`phpstan analyse`)
    - `test` → `artisan config:clear` + `lint:check` + `types:check` + `artisan test` (Pest)
    - `ci:check` → `npm run lint:check` (ESLint) + `npm run format:check` (Prettier) +
      `npm run types:check` (tsc) + `test` (the composer script above)
    - `setup` → composer install, `.env` bootstrap, `key:generate`, `migrate --force`, `npm install`,
      `npm run build`
- **`package.json` `scripts`**: `lint`/`lint:check` (ESLint), `format`/`format:check` (Prettier),
  `types:check` (`tsc --noEmit`), `test` (`vitest run`), `build`/`build:ssr`/`dev` (Vite).
- **CI**: `.github/workflows/tests.yml` — on push to `main` and on PR, runs `composer setup` then
  `composer ci:check` on PHP 8.5 / Node 22.
