# Production Camera Hardware Validation Checklist

> **Manual, human-executed checklist. Not automatable in CI.**
> This checklist must be executed by an operator, by hand, against the **real
> target kiosk device(s)** with a physically connected/embedded camera, using a
> supported kiosk browser. `getUserMedia`/`enumerateDevices` device labels,
> resolutions, and disconnect/reconnect behavior cannot be faithfully emulated
> in headless CI, so this validation is out of scope for automated test suites
> and must be run manually before shipping camera-dependent kiosk hardware to
> production.

## Components under test

- `resources/js/hooks/use-camera.ts` — owns `getUserMedia`/`enumerateDevices`
  lifecycle, device selection (`selectDevice`), disconnect detection
  (`markDisconnected`, the `ended` track listener, and the `devicechange`
  fallback-to-next-device logic), and constraint fallback
  (`buildVideoConstraints` → `buildRelaxedVideoConstraints` on
  `OverconstrainedError`).
- `resources/js/components/camera-preview.tsx` — renders the live `<video>`
  preview, the camera picker (`Select` shown only when `devices.length > 1`),
  and maps `CameraErrorReason` to the kiosk's `KioskErrorState` surfaces
  (`no-camera-permission`, `camera-stream-lost`, `camera-unavailable`).

## Prerequisites

- Target kiosk device(s) with the production camera hardware physically
  attached/embedded, running the supported kiosk browser(s).
- At least one device with **two or more** video input cameras available (to
  exercise selection/switching); if the production kiosk hardware has only one
  camera, note that in the sign-off and skip the switching-specific steps.
- OS-level camera permission for the browser not yet granted at the start of
  the run, so the permission-grant flow can be observed from a clean state.
- Ability to physically disconnect/reconnect the camera (unplug a USB camera,
  or disable/re-enable it in the OS device manager for embedded cameras).
- A way to inspect captured photo output (the kiosk's capture/review step) to
  judge resolution and quality.

---

## Scenario 1 — Permission grant

1. On a fresh browser profile/session with no prior camera permission granted,
   navigate to the kiosk step that mounts `CameraPreview` (it calls `start()`
   on mount).
2. **Expected**: the browser's native permission prompt appears. Accept it.
3. **Pass criteria**: `useCamera`'s `getUserMedia` call resolves, the `<video
   data-testid="camera-preview-video">` element shows a live feed, and no
   `KioskErrorState` is rendered.
4. **Also verify (denial path)**: repeat with the prompt **denied**.
   **Expected**: `CameraPreview` renders `KioskErrorState` with kind
   `no-camera-permission` (mapped from `CameraErrorReason` `'permission-denied'`),
   and the "Retry" action re-invokes `start()` so the operator can re-prompt
   after fixing OS/browser permission settings.

## Scenario 2 — Correct camera selection

1. With permission granted and multiple cameras available, load the kiosk
   camera step.
2. **Expected**: `useCamera` enumerates video input devices (`listVideoInputDevices`)
   and the active stream's `deviceId` (read from the live track's
   `getSettings()`) is reflected as `selectedDeviceId`.
3. **Pass criteria**: the label shown in `camera-preview-device-select` (or the
   static "Camera: <label>" badge when only one device exists) matches the
   physical camera actually feeding the live preview — confirm by covering
   each physical camera lens in turn and observing the correct preview freezes
   dark.

## Scenario 3 — Resolution / aspect handling

1. With the preview active, inspect the live video track's applied settings
   (e.g. via browser devtools: `stream.getVideoTracks()[0].getSettings()`)
   or the rendered `<video>` element's intrinsic size.
2. **Expected**: the requested ideal constraints are `width: 1280`, `height:
   720`, `aspectRatio: 16/9` (`buildVideoConstraints`). The camera should
   negotiate to this or the closest supported resolution/aspect ratio.
3. **Pass criteria**: the preview renders without visible letterboxing/pillarboxing
   artifacts beyond the `object-cover` crop already applied by
   `camera-preview.tsx`, and the negotiated resolution is reasonable for photo
   capture (not a degraded low-res fallback) on the target hardware.
4. **Fallback path**: if the target camera cannot satisfy the ideal
   constraints, `useCamera` retries with `buildRelaxedVideoConstraints`
   (constraints relaxed to just `deviceId`, or `true`) after an
   `OverconstrainedError`. **Expected**: the stream still starts successfully
   rather than surfacing an error, confirming the fallback path works on real
   hardware that may not support the ideal profile.

## Scenario 4 — Camera switching

1. On a device with 2+ cameras, open the `camera-preview-device-select`
   picker and choose a different camera than the currently active one.
2. **Expected**: `selectDevice` calls `start(deviceId)`, which stops the prior
   stream's tracks, requests a new stream constrained to the chosen
   `deviceId`, and updates the preview and `selectedDeviceId` accordingly.
3. **Pass criteria**: the preview visibly switches to the newly selected
   physical camera within a couple of seconds, with no dual-stream flash,
   frozen frame, or leaked/still-active track from the previous camera (verify
   via OS camera-in-use indicator that only one camera is active at a time).
4. Repeat switching back and forth several times to confirm no cumulative
   resource leak (check OS camera indicator / task manager for stray active
   camera sessions after multiple switches).

## Scenario 5 — Capture quality verification

1. Using the kiosk's normal capture flow, take a photo with each available
   camera in turn.
2. **Expected**: captured images are in focus, correctly exposed, and framed
   as previewed (no unexpected crop/rotation mismatch between the live preview
   and the captured still).
3. **Pass criteria**: an operator visually reviews each captured photo in the
   kiosk's review/confirmation step and confirms it is fit for print (sharp,
   correctly oriented, matches what was shown in the live preview).

## Scenario 6 — Reconnection after disconnect

1. While the preview is active, physically disconnect the active camera (unplug
   USB, or disable it via OS device manager for an embedded camera).
2. **Expected**: either the track's `ended` event fires or a
   `devicechange` event fires with no fallback device available, both of which
   route through `markDisconnected()` — stopping any remaining tracks,
   clearing `selectedDeviceId`, and setting `error = 'disconnected'`.
   `CameraPreview` renders `KioskErrorState` with kind `camera-stream-lost`,
   including a "Back to start" action (only offered for this error kind).
3. **Pass criteria**: the disconnect is detected and surfaced within a few
   seconds, without the app crashing or the preview silently freezing on a
   stale frame.
4. Reconnect the camera (plug it back in / re-enable it) and use the "Retry"
   action.
5. **Expected**: `start()` re-runs `getUserMedia`, and if a second camera was
   already active (via the `devicechange`-driven fallback in `useCamera`), the
   originally disconnected camera should also reappear in the device list once
   reconnected.
6. **Pass criteria**: the preview resumes showing a live feed from a working
   camera after retry, with no residual `disconnected` error state.
7. **Multi-camera fallback variant**: on a device with 2+ cameras, disconnect
   the *currently selected* camera while another remains connected.
   **Expected**: the `devicechange` handler in `useCamera` detects the
   selected device is no longer in the enumerated list and automatically calls
   `start()` on the first remaining device, without the operator needing to
   press Retry. **Pass criteria**: the preview automatically switches to the
   remaining camera without ever showing the `camera-stream-lost` error.

## Scenario 7 — Repeated sequential sessions without residual state

1. Complete a full kiosk session end-to-end (arrive at the camera step,
   capture, and proceed away from/unmount the camera step) at least three
   times in a row on the same device, without reloading the browser page
   between sessions.
2. **Expected**: `CameraPreview`'s unmount effect calls `stop()`, which stops
   every track on the current stream and clears `stream`/`streamRef`. The next
   session's mount calls `start()` fresh, re-enumerating devices and
   re-requesting a new stream.
3. **Pass criteria**: each new session's camera step starts a working preview
   with a live stream, with no cumulative growth in active camera sessions
   (check the OS camera-in-use indicator settles back to "no camera in use"
   between sessions, and returns to "in use" only once the next session's
   preview mounts), no reused/stale `selectedDeviceId` from an already-torn-down
   stream, and no memory-leak-driven degradation (increasing lag, delayed
   preview start, or dropped frames) by the third repetition.

---

## Sign-off

Record, for each scenario above: date/time executed, operator name/email,
kiosk device/hardware identifier (make/model of camera and kiosk unit),
browser/OS version, pass/fail, and any notes/screenshots for failures. If the
target kiosk hardware has only a single camera, note this explicitly and mark
the camera-switching-specific checks (Scenario 4, and the multi-camera
fallback variant of Scenario 6) as not applicable rather than failed.
