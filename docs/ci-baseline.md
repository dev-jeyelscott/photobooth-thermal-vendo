# CI Baseline

Recorded state of the project's existing test, static-analysis, lint, and build tooling as of
2026-08-21, verified against `main` at commit `a4decc89b63ff22c36148992344da626c290a82d`. This is a
verification-only snapshot: no application or test code was modified to produce it.

## Summary

| Check                              | Command                             | Result     |
| ----------------------------------- | ------------------------------------ | ---------- |
| Pest test suite                     | `php artisan test --compact`         | ✅ Pass    |
| Larastan/PHPStan (level 7)          | `vendor/bin/phpstan analyse --no-progress` | ❌ Fail (2 pre-existing errors) |
| Pint (check mode)                   | `vendor/bin/pint --test`             | ✅ Pass    |
| TypeScript check                    | `npm run types:check`                | ✅ Pass    |
| ESLint                              | `npm run lint:check`                 | ✅ Pass    |
| Prettier (check mode)               | `npm run format:check`               | ❌ Fail (12 pre-existing files unformatted) |
| Production frontend build           | `npm run build`                      | ✅ Pass    |

No failures were introduced by this task; both failures below pre-date this verification pass and
are documented for later tasks to address separately.

## Details

### Pest test suite — Pass

`php artisan test --compact`

```
{"tool":"pest","result":"passed","tests":166,"passed":166,"assertions":834,"duration_ms":37936}
```

### Larastan/PHPStan — Fail (pre-existing)

`vendor/bin/phpstan analyse --no-progress`

2 errors, both in `app/Actions/Payments/ProcessMayaWebhook.php`:

```
app/Actions/Payments/ProcessMayaWebhook.php:63
  Parameter #1 $num1 of function bccomp expects numeric-string, string given. (argument.type)
  Parameter #2 $num2 of function bccomp expects numeric-string, string given. (argument.type)
```

### Pint (check mode) — Pass

`vendor/bin/pint --test`

```
{"tool":"pint","result":"passed"}
```

### TypeScript check — Pass

`npm run types:check` (`tsc --noEmit`) completed with no output/errors.

### ESLint — Pass

`npm run lint:check` (`eslint .`) completed with no output/errors.

### Prettier (check mode) — Fail (pre-existing)

`npm run format:check` (`prettier --check resources/`) reports 12 files with formatting issues:

```
resources/js/components/__tests__/capture-step.test.tsx
resources/js/components/__tests__/sticker-selection-step.test.tsx
resources/js/components/__tests__/template-selection-step.test.tsx
resources/js/components/kiosk-error-state.tsx
resources/js/components/preview-step.tsx
resources/js/components/sticker-selection-step.tsx
resources/js/components/template-selection-step.tsx
resources/js/hooks/use-photobooth-session.ts
resources/js/layouts/kiosk-layout.tsx
resources/js/pages/__tests__/kiosk.test.tsx
resources/js/pages/gallery.tsx
resources/js/pages/kiosk.tsx
```

### Production frontend build — Pass

`npm run build` (`vite build`) completed successfully, producing `public/build/manifest.json` and
associated assets with no errors.

## Pre-existing failures to track separately

- **PHPStan `argument.type` in `ProcessMayaWebhook.php:63`** — `bccomp()` is called with plain
  `string` arguments where a `numeric-string` is expected. Needs a fix in a dedicated task, not as
  part of this baseline verification.
- **Prettier formatting drift in 12 files** — the files listed above no longer match the project's
  Prettier configuration. Needs a formatting pass in a dedicated task, not as part of this baseline
  verification.
