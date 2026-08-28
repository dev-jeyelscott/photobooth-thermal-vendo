# Thermal Printer Hardware Tuning and Validation Checklist

> **Manual, human-executed checklist. Not automatable in CI.**
> This checklist must be executed by an operator, by hand, against the **real
> physical thermal printer** wired to the `print_bridge` transport (or the
> production `PrinterDriver` in use). Print head density, dithering fidelity,
> paper feed/cut behavior, and offline/hardware-fault handling cannot be
> faithfully emulated in headless CI or with `local_mock`, so this validation
> is out of scope for automated test suites and must be run manually on-site
> before shipping printer-dependent kiosk hardware to production.

## Components under test

- `app/Services/Printing/ReceiptRenderer.php` — scales the captured media to
  `receipt_printer_width_px`, applies binary thresholding at
  `receipt_threshold`, and optionally appends the session-info footer.
- `app/Services/Printing/PrinterDriver.php` and its configured implementation
  (`printer_drivers.<default_printer_driver>`, e.g. `PrintBridgePrinterDriver`
  talking to the `print_bridge` HTTP endpoint) — the transport that hands the
  rendered image to the physical printer.
- `app/Jobs/ProcessPrintJob.php` — drives the `PrintJob` lifecycle
  (`Pending`/`Failed` → `Printing` → `Printed`/`Failed`) and records
  `attempt_count`, `started_at`, `completed_at`, and `last_error`.
- `app/Console/Commands/RetryPrintJob.php` (`print-jobs:retry {printJob}`) —
  re-dispatches a `Failed` `PrintJob` for another attempt.

## Relevant configuration keys

| Config key | Purpose |
| --- | --- |
| `photobooth.receipt_printer_width_px` (`PHOTOBOOTH_RECEIPT_PRINTER_WIDTH_PX`) | Target pixel width the receipt is scaled to before thresholding. Must match the physical paper width (384px ≈ 58mm, 576px ≈ 80mm). |
| `photobooth.receipt_threshold` (`PHOTOBOOTH_RECEIPT_THRESHOLD`) | Luminance cutoff (0–255) used for black/white thresholding — the dithering/density-related tuning knob. |
| `photobooth.receipt_include_session_info` | Whether a footer with session token/date is appended (affects usable print height and cut position). |
| `photobooth.default_printer_driver` / `photobooth.printer_drivers` (`PHOTOBOOTH_DEFAULT_PRINTER_DRIVER`) | Selects which `PrinterDriver` implementation handles the job (`local_mock` for dev, `print_bridge` for production hardware). |
| `photobooth.print_bridge.endpoint` / `.timeout_seconds` / `.auth_token` (`PHOTOBOOTH_PRINT_BRIDGE_*`) | Connection details for the network print-bridge service fronting the physical printer, used when `print_bridge` is selected. |

## Prerequisites

- A physical thermal printer connected to the print-bridge service (or the
  production transport in use), with `PHOTOBOOTH_DEFAULT_PRINTER_DRIVER=print_bridge`
  and `PHOTOBOOTH_PRINT_BRIDGE_ENDPOINT` pointed at that service.
- Loaded paper roll matching the width the kiosk is configured for
  (`receipt_printer_width_px`).
- Ability to trigger the full kiosk flow through to receipt printing (or to
  directly dispatch `ProcessPrintJob` for an existing session with captured
  media, e.g. via `php artisan tinker` on the target environment).
- Access to the `print_jobs` table (or an admin view) to inspect `status`,
  `attempt_count`, `last_error`, `started_at`, and `completed_at`.
- A phone or QR scanner app to test printed QR readability, if the receipt
  includes a QR code.

---

## Scenario 1 — Paper width configuration

1. Confirm `PHOTOBOOTH_RECEIPT_PRINTER_WIDTH_PX` matches the loaded paper's
   printable width (e.g. `384` for 58mm, `576` for 80mm stock).
2. Run a full print job end-to-end.
3. **Expected**: `ReceiptRenderer::render()` scales the source image to
   exactly this pixel width before thresholding.
4. **Pass criteria**: the printed receipt uses the full printable width with
   no unprinted margin strip on one side and no image content clipped off the
   edge. If a mismatch is observed, correct `receipt_printer_width_px` to
   match the physical paper and re-run this scenario — this is a
   configuration fix, not a code fix.

## Scenario 2 — Image scaling / aspect ratio

1. Print receipts for sessions using photo templates of differing aspect
   ratios (e.g. strip vs. wide layouts, if supported).
2. **Expected**: `ReceiptRenderer` scales by width only (`scale(width: ...)`),
   preserving the source aspect ratio; height varies with content.
3. **Pass criteria**: printed output is not stretched or squashed relative to
   the on-screen preview/review step, and faces/subjects are proportionally
   correct.

## Scenario 3 — Print density

1. With the printer's density/heat setting at its default, print a receipt
   containing a range of tones (light background, mid-tone skin, dark
   clothing/hair).
2. **Expected**: `receipt_threshold` (default `128`) has already reduced the
   image to pure black/white before it reaches the printer, so density
   primarily affects how dark the "black" pixels render and whether faint
   thresholding artifacts appear.
3. **Pass criteria**: black areas are solid and uniformly dark (no visible
   graying/streaking), white areas remain clean paper-white with no
   scorching, and there is no visible banding across the width of the print.
4. If density is poor, adjust the printer's hardware/firmware density
   setting (not `receipt_threshold`, which controls thresholding, not printer
   heat) and re-run.

## Scenario 4 — Dithering quality

1. Print a receipt built from a source photo with smooth tonal gradients
   (e.g. a face with soft shadow falloff).
2. **Expected**: `ReceiptRenderer::threshold()` performs a hard black/white
   cutoff at `receipt_threshold` per pixel — there is no dithering
   (Floyd–Steinberg or similar) applied in software today.
3. **Pass criteria**: confirm this hard-threshold behavior is acceptable for
   production output quality (blocky transitions in gradient areas are
   expected, not a printer fault). If output quality is unacceptable, **do
   not modify `ReceiptRenderer` under this task** — record the gap in the
   sign-off as a follow-up (see "Discovered gaps" below) instead of fixing it
   here. Try adjusting `receipt_threshold` toward the source image's typical
   midtone as a configuration-only tuning step and re-test.

## Scenario 5 — Cut command behavior (if supported)

1. If the physical printer/print-bridge transport supports an auto-cut
   command, print several receipts in sequence.
2. **Expected**: each `PrintJob` corresponds to one complete, cleanly
   separated printout — `PrintBridgePrinterDriver::send()` posts one image per
   job to the bridge endpoint.
3. **Pass criteria**: the printer cuts (or perforates, for tear-bar hardware)
   between each print with no leftover blank feed and no cut mid-image. If
   the printer/bridge does not support an auto-cut command, mark this
   scenario **not applicable** and confirm the tear-bar/manual-tear edge is
   clean and does not clip printed content.

## Scenario 6 — QR code readability on printed output

1. If the receipt template includes a QR code (e.g. digital gallery link),
   print it and scan it with a phone camera/QR app under normal ambient
   lighting.
2. **Expected**: the QR module size survives the scale-to-`receipt_printer_width_px`
   and threshold steps without losing modules.
3. **Pass criteria**: the QR code scans successfully on the first or second
   attempt and resolves to the correct URL. If scanning is unreliable, check
   whether the QR's source resolution is high enough relative to
   `receipt_printer_width_px` before treating it as a hardware issue.

## Scenario 7 — Multiple sequential print jobs

1. Trigger three or more `PrintJob`s back-to-back (e.g. three kiosk sessions
   in a row, or manually dispatching `ProcessPrintJob` for three prepared
   sessions).
2. **Expected**: `ProcessPrintJob::handle()` claims each job individually
   under a row lock, transitioning `Pending` → `Printing` → `Printed`, with
   `attempt_count` incrementing once per job and `completed_at` set on
   success.
3. **Pass criteria**: all jobs print correctly and in the order dispatched,
   with no dropped jobs, no interleaved/corrupted images, and each
   `print_jobs` row showing `status = printed` with a distinct
   `completed_at`.

## Scenario 8 — Printer offline handling

1. Physically power off the printer (or disconnect it from the print-bridge
   host), then trigger a print job.
2. **Expected**: `PrintBridgePrinterDriver::send()` fails (connection error or
   non-2xx response, subject to `print_bridge.timeout_seconds`), which
   `ProcessPrintJob::handle()` catches, setting the job to `PrintJobStatus::Failed`
   with `last_error` populated and no `completed_at`. The customer-facing
   session is not corrupted by this failure.
3. **Pass criteria**: the `print_jobs` row shows `status = failed` with a
   descriptive `last_error` (e.g. connection refused/timeout), and the kiosk
   does not crash or hang waiting on the print step.
4. Power the printer back on/reconnect it before proceeding to Scenario 9.

## Scenario 9 — Retry of a failed print job

1. Starting from a `Failed` job (e.g. from Scenario 8, or any job with
   `status = failed`), run `php artisan print-jobs:retry {printJob}` (see
   `app/Console/Commands/RetryPrintJob.php`).
2. **Expected**: the command validates the job is currently `Failed` and
   dispatches `ProcessPrintJob` again; on the next `handle()` run,
   `attempt_count` increments again and, on success, `status` becomes
   `Printed` with `last_error` left at its prior value and a fresh
   `completed_at`.
3. **Pass criteria**: the retried job prints successfully on the physical
   printer, `attempt_count` reflects the total number of attempts, and
   attempting to retry a job that is **not** `Failed` (e.g. already
   `Printed`) is rejected by the command with no re-print and no queued job.

---

## Discovered gaps

If any scenario above surfaces a genuine defect in `ReceiptRenderer`,
`PrinterDriver` implementations, or the `PrintJob` retry lifecycle (as opposed
to a configuration/hardware tuning issue), **do not fix it as part of this
checklist**. Record the scenario, observed behavior, and expected behavior
here (or in the sign-off notes) so it can be triaged as a separate task.

## Sign-off

Record, for each scenario above: date/time executed, operator name/email,
printer make/model and paper width used, `print_bridge` endpoint/transport
configuration, pass/fail, and any notes/photos for failures. If the target
printer hardware does not support an auto-cut command, mark Scenario 5 as
not applicable per the note in that scenario rather than failed.
