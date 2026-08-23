---
paths:
  - 'resources/js/pages/admin/**/*.tsx'
---

# Admin

## Admin page shell ownership

The Inertia resolver applies AppLayout to every admin page. Admin pages must render only page content and pass breadcrumbs through setLayoutProps(); never import or render AppLayout inside an admin page.

## Canonical admin design-system contract

Before creating, modifying, or redesigning any admin UI, read `design-system.html`, inspect `resources/css/app.css`, inspect existing `resources/js/components/ui/**`, inspect reusable `resources/js/components/**`, and inspect comparable existing application patterns.

Follow this decision order:

1. Reuse an existing semantic design token when one satisfies the requirement.
2. Reuse an existing UI primitive when one satisfies the requirement.
3. Reuse an existing component variant when one satisfies the requirement.
4. Reuse an existing composite or application pattern when one satisfies the requirement.
5. Extend an existing primitive or component only for a legitimate reusable variation.
6. Create a new token, primitive, component, variant, or pattern only after proving that the Canonical Admin UI Contract does not support the requirement.

A screenshot or design mockup defines visual intent, not application behavior. Existing repository contracts and the Canonical Admin UI Contract remain authoritative unless explicitly changed by the task.

Reuse before extension. Extend before creation. Creation requires evidence of a real reusable design-system gap.

Whenever a reusable design token, component, variant, or application pattern is legitimately added or changed, update `design-system.html` in the same change. Theme-dependent tokens must have intentional light-mode and dark-mode behavior, and shared interactive UI must preserve accessibility, responsive behavior, focus-visible treatment, invalid states, and disabled states.

Do not introduce page-specific semantic colors, control styling, radius values, shadows, status systems, or duplicate shadcn/Radix primitives when the existing design system already supports the requirement. Do not change routes, submitted field names or values, authorization, validation, state transitions, or domain workflows for visual convenience.
