# TASK-102: Browser and Device Matrix Validation

## Environment constraint

This validation was performed from a Linux CLI sandbox with no display
server (`$DISPLAY` unset, no X/Wayland session) and no operator present to
drive touch/mouse UI interactions. A physical inventory of this environment
was taken:

- A USB webcam (`GENERAL WEBCAM`, `/dev/video0`/`/dev/video1`) and
  Google Chrome 151 (Linux) are present, but the device node is owned by the
  `video` group, which the sandbox user is not a member of, and there is no
  display to render/drive a real browser UI against it.
- There is no Safari, no Edge, no iPadOS device, and no Android tablet
  reachable from this Linux sandbox — Safari and Edge are not distributed for
  this OS, and no mobile/tablet hardware is attached.
- The task constraints prohibit introducing a new browser-automation
  framework (Playwright/Cypress/Puppeteer) without explicit approval, so
  scripted UI-driving against the one camera that is physically present is
  also out of scope here.

None of the six required device/browser combinations can therefore be
genuinely exercised end-to-end (permission prompt, enumeration, switching,
capture, upload, full-screen kiosk UX) from this environment. Fabricating
pass/fail outcomes would violate the explicit no-fabrication constraint for
this task. The sections below record what **was** verified here, and flag
the manual matrix as a blocker requiring an operator with physical access to
the target devices.

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

## Manual device/browser matrix — BLOCKED, requires operator with physical access

The matrix below could not be exercised here (see "Environment constraint"
above) and must be completed by an operator with access to the physical
devices/browsers before this task can be closed out with real pass/fail
evidence:

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
