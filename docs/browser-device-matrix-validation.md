# TASK-102: Browser and Device Matrix Validation

## Environment constraint

This validation was performed in a headless CI-style sandbox with no attached
camera hardware, no iPadOS/Android devices, no external USB webcam, and no
permitted browser-automation tooling for driving a real browser UI. Live
manual pass/fail execution across the target device matrix could not be
performed from this environment. The sections below record what **was**
verified here, and what remains outstanding for a operator with physical
access to the target devices.

## What was verified in this environment

### Production build

`npm run build` was run and completed successfully (see verification below),
so the code-level checks below reflect the same bundles a real device would
load.

### Camera/browser API audit (standards-only check)

Reviewed `resources/js/hooks/use-camera.ts`, `resources/js/components/camera-preview.tsx`,
and `resources/js/components/capture-step.tsx`:

- Permission + stream acquisition: `navigator.mediaDevices.getUserMedia` (standard).
- Enumeration: `navigator.mediaDevices.enumerateDevices` filtered to `videoinput` (standard).
- Switching: re-invokes `getUserMedia` with an explicit `deviceId` constraint (standard).
- Device hot-plug handling: `navigator.mediaDevices` `devicechange` event and
  `MediaStreamTrack` `ended` event (standard).
- Capture: draws the active `<video>` frame to a `<canvas>` and reads it via
  `canvas.toDataURL('image/jpeg', ...)` (standard Canvas API).
- Full-screen kiosk layout: achieved via CSS (`min-h-dvh`, flex layout) on the
  root kiosk container, not the vendor-specific Fullscreen API
  (`requestFullscreen`/`webkitRequestFullscreen`/etc. are not used anywhere in
  `resources/js`).

No vendor-prefixed or non-standard camera/browser API was found in the kiosk
capture path. This satisfies the "no vendor-specific API" acceptance
criterion independent of live device execution.

## Manual device/browser matrix — NOT executed (outstanding)

The matrix below could not be exercised here and must be completed by an
operator with access to the physical devices/browsers before this task can
be closed out with real pass/fail evidence:

| Device / Browser | Permission | Enumeration | Switching | Capture | Upload | Full-screen kiosk UX |
|---|---|---|---|---|---|---|
| Safari, iPadOS (recent) | not executed | not executed | not executed | not executed | not executed | not executed |
| Chrome, Android tablet | not executed | not executed | not executed | not executed | not executed | not executed |
| Chrome, desktop | not executed | not executed | not executed | not executed | not executed | not executed |
| Edge, desktop | not executed | not executed | not executed | not executed | not executed | not executed |
| Laptop webcam | not executed | not executed | not executed | not executed | not executed | not executed |
| Supported external USB webcam | not executed | not executed | not executed | not executed | not executed | not executed |

If a defect is found while completing this matrix, file it as a separate
follow-up task rather than patching kiosk/capture code inline as part of
closing this record.

## Verification commands executed

- `npm run build` — succeeded.
- `php artisan test --filter=KioskTest` — 11 passed, 88 assertions.
