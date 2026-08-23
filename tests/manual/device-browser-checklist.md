# Device & Browser Testing Checklist

Manual checklist for validating that the kiosk's camera capture
(`resources/js/hooks/use-camera.ts`, `resources/js/components/camera-preview.tsx`,
`resources/js/components/capture-step.tsx`) and responsive UI remain
device-agnostic. Run the full sequence below on each configuration and
record pass/fail results in the "Test Pass Log" section.

## Pass criteria per configuration

For every device/browser row, verify all four checks:

1. **Camera access (`getUserMedia`)** — Opening the capture step prompts for
   camera permission (or reuses a prior grant) and the live video preview
   renders within a few seconds. Denying permission shows the
   `no-camera-permission` error state with a working retry.
2. **Camera selection/enumeration** — If more than one video input is
   present, the camera picker (`camera-preview-device-select`) lists every
   camera with a usable label and switching devices swaps the live preview
   without a page reload. On single-camera devices, the picker is correctly
   hidden.
3. **Responsive layout (portrait/landscape)** — Rotating the device (or
   resizing the window) keeps the capture UI, countdown overlay, and
   review/retake controls fully visible and usable without clipping,
   overlap, or horizontal scrolling in both orientations.
4. **Touch vs. mouse interaction** — All interactive controls (camera
   picker, Retake, Keep & Continue, back-to-start) respond correctly to the
   device's primary input method (tap on touchscreens, click on
   mouse/trackpad) with no missed or double-firing events.

## Configurations

| #   | Device            | Browser        | Input                        | Camera                   |
| --- | ----------------- | -------------- | ---------------------------- | ------------------------ |
| 1   | iPad              | Safari         | Touch                        | Front/rear built-in      |
| 2   | Android tablet    | Chrome         | Touch                        | Front/rear built-in      |
| 3   | Desktop           | Chrome         | Mouse                        | Built-in/external webcam |
| 4   | Desktop           | Edge           | Mouse                        | Built-in/external webcam |
| 5   | Laptop            | Chrome or Edge | Touch (if available) + mouse | Built-in webcam          |
| 6   | Laptop or desktop | Chrome or Edge | Mouse                        | External USB webcam      |

Row 6 (external USB webcam) applies only where the OS/browser exposes the
device as a standard `videoinput` — Safari on iPadOS does not support
external UVC webcams, so this row is skipped for iPad.

## Camera API audit (iPad/vendor-specific usage)

Static grep audit of the camera capture code confirms only the standard
`navigator.mediaDevices` API (`getUserMedia`, `enumerateDevices`,
`devicechange`) is used — no iPad-specific, WebKit-prefixed, or other
vendor-specific camera APIs are present.

```
$ grep -rniE "webkit|\bipad\b|\bios\b|\bsafari\b|vendor|moz[A-Z]|ms[A-Z][a-zA-Z]*Camera" \
    resources/js/hooks/use-camera.ts \
    resources/js/components/camera-preview.tsx \
    resources/js/components/capture-step.tsx
# (no output — no vendor/iPad-specific API matches, exit code 1)
```

Audited files: `resources/js/hooks/use-camera.ts`,
`resources/js/components/camera-preview.tsx`,
`resources/js/components/capture-step.tsx`.

## Test Pass Log

Record one row per configuration for each completed pass. Use ✅ Pass,
❌ Fail, or ⚠️ Partial, with notes for any failure.

### Pass 1 — 2026-08-20 (BLOCKED — no results recorded)

| #   | Device / Browser         | Camera access | Camera selection | Responsive layout | Touch/mouse interaction | Notes                                                                       |
| --- | ------------------------ | :-----------: | :--------------: | :---------------: | :---------------------: | --------------------------------------------------------------------------- |
| 1   | iPad / Safari            | not executed  |   not executed   |    not executed    |      not executed       | No physical iPad/Safari device available in this environment.              |
| 2   | Android tablet / Chrome  | not executed  |   not executed   |    not executed    |      not executed       | No physical Android tablet available in this environment.                  |
| 3   | Desktop / Chrome         | not executed  |   not executed   |    not executed    |      not executed       | No camera-equipped desktop available in this environment.                  |
| 4   | Desktop / Edge           | not executed  |   not executed   |    not executed    |      not executed       | No camera-equipped desktop available in this environment.                  |
| 5   | Laptop / built-in webcam | not executed  |   not executed   |    not executed    |      not executed       | No camera-equipped laptop available in this environment.                   |
| 6   | External USB webcam      | not executed  |   not executed   |    not executed    |      not executed       | No external USB webcam available in this environment.                      |

This environment has no attached camera hardware or the listed physical
devices, so this pass could not be executed and no results are fabricated —
none of the cells above are marked pass/fail. This checklist is a
supplementary companion to `docs/browser-device-matrix-validation.md`, which
is the authoritative record for the task's acceptance criteria. Before this
task is accepted for release, an operator with the actual target
hardware/browsers must run this checklist and replace every "not executed"
cell with a real pass/fail result.
