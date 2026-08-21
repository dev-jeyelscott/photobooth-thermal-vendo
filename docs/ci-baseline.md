# CI Baseline

Recorded state of the project's existing test, static-analysis, lint, and build tooling as of
2026-08-21, verified against `main` at commit `1b014727af27a5b5c70df0b95e28974792add0a7`. This is a
verification-only snapshot: no application or test code was modified to produce it.

## Summary

| Check                              | Command                             | Result     |
| ----------------------------------- | ------------------------------------ | ---------- |
| Pest test suite                     | `php artisan test --compact`         | ✅ Pass    |
| Larastan/PHPStan (level 7)          | `vendor/bin/phpstan analyse --no-progress` | ✅ Pass |
| Pint (check mode)                   | `vendor/bin/pint --test`             | ✅ Pass    |
| TypeScript check                    | `npm run types:check`                | ✅ Pass    |
| ESLint                              | `npm run lint:check`                 | ✅ Pass    |
| Prettier (check mode)               | `npm run format:check`               | ✅ Pass    |
| Production frontend build           | `npm run build`                      | ✅ Pass    |

All checks pass cleanly at this commit. No pre-existing failures were found and no failures were
introduced by this verification pass.

## Details

### Pest test suite — Pass

`php artisan test --compact`

```
{"tool":"pest","result":"passed","tests":167,"passed":167,"assertions":837,"duration_ms":36456}
```

### Larastan/PHPStan — Pass

`vendor/bin/phpstan analyse --no-progress`

```
{"tool":"phpstan","result":"passed","errors":0}
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

### Prettier (check mode) — Pass

`npm run format:check` (`prettier --check resources/`) reports all matched files use Prettier code
style.

### Production frontend build — Pass

`npm run build` (`vite build`) completed successfully in ~5.4s, producing
`public/build/manifest.json` and associated assets with no errors.

## History

- A prior verification pass at commit `a4decc89b63ff22c36148992344da626c290a82d` found two
  pre-existing failures: a PHPStan `argument.type` error in
  `app/Actions/Payments/ProcessMayaWebhook.php` and Prettier formatting drift across 12 frontend
  files. Both were subsequently resolved in commit `cd31a04` (a dedicated repair task, not this
  verification task). This snapshot confirms the fixes hold and the full tool chain is currently
  green.
