---
paths:
  - 'app/Services/Payments/**'
---

# Payments

## Retry only transient PayMongo webhook failures
Webhook create/update requests use deterministic idempotency keys and may retry connection and provider 5xx failures with bounded backoff. Do not retry 4xx responses because those represent credential or configuration errors that require operator action.
