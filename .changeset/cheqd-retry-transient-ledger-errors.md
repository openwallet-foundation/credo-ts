---
'@credo-ts/cheqd': minor
---

Retry idempotent cheqd ledger reads (DID and resource resolution) on transient transport errors, and add `CheqdLedgerService.resolveLatestResource`, a one-request lookup for the latest version of a named, typed resource in a DID's collection. Never applied to writes/transactions.
