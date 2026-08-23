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

## Re-check (2026-08-22)

Re-verified the environment constraint still holds: no `$DISPLAY`, sandbox
user (`john-leward-escote`) is not in the `video` group (`id -nG` shows
`adm cdrom sudo dip plugdev users lpadmin lxd docker`, no `video`), and no
Safari/Edge/iPadOS/Android hardware is reachable from this host. `npm run
build` and `php artisan test --filter=KioskTest` were re-run and both still
pass. No new capability to physically drive the six required device/browser
combinations exists in this sandbox, so the matrix above remains genuinely
unexecuted rather than fabricated. This record still requires an operator
with physical device access to fill in real pass/fail results before the
task can be closed.

## Re-check (2026-08-23)

Same environment state confirmed again: `$DISPLAY` unset, sandbox user
still not a member of the `video` group, `/dev/video0`/`/dev/video1` still
present but inaccessible for a driven UI session, and still no
Safari/Edge/iPadOS/Android reachable from this host. `npm run build`
succeeded and `php artisan test --filter=KioskTest` passed (11 passed, 88
assertions). No genuine pass/fail evidence for the six-device matrix can be
produced from this sandbox; fabricating outcomes would violate the
no-fabrication constraint, so the matrix remains blocked pending an
operator with physical access to the target devices.

## Re-check (2026-08-23, attempt 8)

Environment re-inspected again with no change from the previous re-checks:
`$DISPLAY` is still unset, `id -nG` for the sandbox user still shows
`john-leward-escote adm cdrom sudo dip plugdev users lpadmin lxd docker`
(no `video` group), and this host still has no Safari, no Edge, and no
iPadOS/Android hardware attached. `npm run build` completed successfully
(bundles emitted to `public/build/assets`, including `kiosk-*.js`) and
`php artisan test --filter=KioskTest` passed (11 passed, 88 assertions).
This is a hardware/manual-testing blocker, not a code defect — no further
coding change in this sandbox can produce genuine pass/fail evidence for
the six-device matrix. The matrix remains open pending an operator with
physical access to the target devices; per this task's constraints, no
speculative fix or workaround has been applied to
`resources/js/pages/kiosk.tsx` or `resources/js/components/capture-step.tsx`.

## Re-check (2026-08-23, attempt 9)

Re-inspected the environment again: `$DISPLAY` is still unset, `id -nG` for
the sandbox user (`john-leward-escote`) still shows
`adm cdrom sudo dip plugdev users lpadmin lxd docker` (no `video` group),
and `/dev/video0`/`/dev/video1` are present but still not group-accessible
and there is no display to drive a real browser session against them. This
host has no Safari, no Edge, and no iPadOS/Android hardware attached.
`npm run build` was re-run and completed successfully (`public/build/assets`
includes `kiosk-BOHNCFrQ.js`), and `php artisan test --filter=KioskTest`
passed (11 passed, 88 assertions). No new capability to physically exercise
the six required device/browser combinations has appeared in this sandbox
across nine attempts. Per the task's explicit no-fabrication constraint,
the matrix cells are left as `not executed` rather than invented pass/fail
outcomes. This task requires handoff to an operator with physical access to
Safari/iPadOS, Chrome Android tablet, Chrome desktop, Edge desktop, a laptop
webcam, and a supported external USB webcam to produce genuine results; no
further sandbox re-check is expected to change this conclusion.

## Re-check (2026-08-23, attempt 10)

Re-inspected the environment once more: `$DISPLAY` is still unset, `id -nG`
for the sandbox user still shows
`john-leward-escote adm cdrom sudo dip plugdev users lpadmin lxd docker` (no
`video` group), and `/dev/video0`/`/dev/video1` are still present but not
group-accessible with no display to drive a real browser session against
them. Only `google-chrome` is installed on this host; no Safari, no Edge,
and no iPadOS/Android hardware is reachable. `npm run build` was re-run and
completed successfully (`public/build/assets/kiosk-BOHNCFrQ.js` emitted),
and `php artisan test --filter=KioskTest` passed (11 passed, 88 assertions).
No new capability to physically exercise the six required device/browser
combinations exists in this sandbox. Consistent with the explicit
no-fabrication constraint, the matrix cells remain `not executed` rather
than invented pass/fail outcomes, and no changes were made to
`resources/js/pages/kiosk.tsx` or `resources/js/components/capture-step.tsx`.
This task remains blocked on an operator with physical access to the target
devices; it cannot be completed from this sandbox.

## Re-check (2026-08-23, attempt 11)

Re-inspected the environment once more, immediately after the previous
re-check: `$DISPLAY` is still unset, `id -nG` for the sandbox user still
shows `john-leward-escote adm cdrom sudo dip plugdev users lpadmin lxd
docker` (no `video` group), and `/dev/video0`/`/dev/video1` are still
present but owned by `root:video` with no display to drive a real browser
session against them. Only `google-chrome` is installed on this host; `which`
finds no `chromium`, `chromium-browser`, `safari`, or `msedge`, and no
iPadOS/Android hardware is reachable. `npm run build` was re-run and
completed successfully (`public/build/assets/kiosk-BOHNCFrQ.js` emitted),
and `php artisan test --filter=KioskTest` passed (11 passed, 88 assertions).
No new capability to physically exercise the six required device/browser
combinations exists in this sandbox across eleven attempts. Consistent with
the explicit no-fabrication constraint, the matrix cells remain `not
executed` rather than invented pass/fail outcomes, and no changes were made
to `resources/js/pages/kiosk.tsx` or `resources/js/components/capture-step.tsx`.
This task cannot be completed by an automated coding agent in this sandbox;
it requires handoff to a human operator with physical access to Safari on
iPadOS, Chrome on an Android tablet, Chrome desktop, Edge desktop, a laptop
webcam, and a supported external USB webcam to record genuine pass/fail
results and, if needed, file follow-up defect tickets.

## Re-check (2026-08-23, attempt 12)

Re-inspected the environment once more: `$DISPLAY` is still unset, `id -nG`
for the sandbox user still shows
`john-leward-escote adm cdrom sudo dip plugdev users lpadmin lxd docker` (no
`video` group), and `/dev/video0`/`/dev/video1` are still present but owned
by `root:video` with no display to drive a real browser session against
them. Only `google-chrome` is installed on this host; there is still no
Safari, no Edge, and no iPadOS/Android hardware reachable. `npm run build`
was re-run and completed successfully (`public/build/assets/kiosk-BOHNCFrQ.js`
emitted), and `php artisan test --filter=KioskTest` passed (11 passed, 88
assertions). No new capability to physically exercise the six required
device/browser combinations exists in this sandbox across twelve attempts.
Consistent with the explicit no-fabrication constraint, the matrix cells
remain `not executed` rather than invented pass/fail outcomes, and no
changes were made to `resources/js/pages/kiosk.tsx` or
`resources/js/components/capture-step.tsx`. This task requires a human
operator with physical access to the target devices to produce genuine
results; no further automated re-check in this sandbox is expected to
change this conclusion.

## Re-check (2026-08-23, attempt 13)

Re-confirmed the environment is unchanged: `$DISPLAY` is empty, `id -nG`
still lacks `video`, only `/usr/bin/google-chrome` is present (no Safari, no
Edge, no iPadOS/Android hardware), and `/dev/video0`/`/dev/video1` remain
present but inaccessible without a display or `video` group membership.
`npm run build` succeeded again and `php artisan test --filter=KioskTest`
passed again (11 passed, 88 assertions). This is a durable capability gap of
the CLI sandbox this agent runs in, not a transient condition, so repeating
this exact automated re-check on further attempts will not change the
outcome. Completing the six-row matrix requires an operator with physical
Safari/iPadOS, Chrome/Android tablet, Chrome desktop, Edge desktop, a laptop
webcam, and a supported external USB webcam to actually run the kiosk
capture flow and record real pass/fail results.

## Re-check (2026-08-23, attempt 14) — escalation, no further automated re-checks

Re-confirmed once more, for the fourteenth time, that the environment is
unchanged: `$DISPLAY` is empty, `id -nG` still lacks `video`
(`john-leward-escote adm cdrom sudo dip plugdev users lpadmin lxd docker`),
`/dev/video0`/`/dev/video1` are still `root:video`-owned and inaccessible to
this user with no display available, only `/usr/bin/google-chrome` is
installed, and no Safari, Edge, iPadOS, or Android hardware is reachable
from this host. `npm run build` succeeded again
(`public/build/assets/kiosk-BOHNCFrQ.js` emitted) and
`php artisan test --filter=KioskTest` passed again (11 passed, 88
assertions).

This is a durable, non-transient capability gap of the automated coding
sandbox, confirmed identically across fourteen separate attempts. No
further automated re-check of this same environment is expected to produce
a different result, and repeating it again would not add new information.
**This task cannot be completed by an automated coding agent and requires
escalation to a human operator** with physical access to: recent Safari on
iPadOS, Chrome on an Android tablet, Chrome desktop, Edge desktop, a laptop
webcam, and a supported external USB webcam. That operator must run the
production build (`npm run build`) followed by the kiosk capture flow on
each target and replace the "not executed" cells above with real pass/fail
results, filing any discovered device/browser-specific defect as a separate
follow-up task rather than editing `resources/js/pages/kiosk.tsx` or
`resources/js/components/capture-step.tsx` inline. No code changes were
made in this attempt.
