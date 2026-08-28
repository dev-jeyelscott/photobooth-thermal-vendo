---
paths:
  - 'app/{Actions,Http,Console,Services}/**'
---

# Actions Http Console Services

## Resolve photobooth media from the configured media disk
All photobooth media reads, writes, URLs, and deletes use config('filesystems.media'), which defaults to the public disk via MEDIA_DISK. Do not access this media through FILESYSTEM_DISK or a hard-coded disk name.
