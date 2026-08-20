---
paths:
  - 'app/{Actions,Http,Console}/**'
---

# Actions Http Console

## Photobooth media uses the named public disk
Captured media, templates, stickers, rendered receipts, and gallery URLs explicitly use Storage::disk('public'). Production storage/app/public must persist across releases and be exposed through the public/storage symlink; do not rely on the default filesystem disk for these assets.
