---
paths:
  - 'resources/js/pages/admin/**/*.tsx'
---

# Admin

## Admin page shell ownership
The Inertia resolver applies AppLayout to every admin page. Admin pages must render only page content and pass breadcrumbs through setLayoutProps(); never import or render AppLayout inside an admin page.
