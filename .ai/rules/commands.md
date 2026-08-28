---
paths:
  - 'app/Console/Commands/**'
---

# Commands

## Stale Maya payments are webhook-authoritative
Scheduler reconciliation may flag or log aged pending Maya payments for operator review, but must never mark a payment successful or transition its session. Only a verified Maya webhook may apply payment success.
