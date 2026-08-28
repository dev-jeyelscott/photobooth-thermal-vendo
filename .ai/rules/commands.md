---
paths:
  - 'app/Console/Commands/**'
---

# Commands

## PayMongo financial success remains provider-authoritative

A Payment may become successful only from either a verified PayMongo webhook or server-side reconciliation of that exact stored PayMongo Payment Intent using the Payment's historical `paymongo_account_id`.

Reconciliation must validate the exact historical tenant account, provider Payment Intent ID, Payment ID when successful, amount, currency, and Test/Live mode before applying the same locked payment/session mutation used by webhook processing.

Never use the Business's currently selected PayMongo account as a fallback for an existing Payment, never use ThermaSnap platform credentials, and never reopen an expired or otherwise terminal photobooth session because of a late financial success.
