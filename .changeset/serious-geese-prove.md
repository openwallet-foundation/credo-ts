---
"@credo-ts/core": patch
---

Add a new W3C Data Integrity module to core with proof models, validation helpers, processing utilities, and structured create/verify result handling.

The module introduces a cryptosuite registry and Data Integrity proof service/API for proof creation, single-proof verification, and proof-set/chain verification flows, plus an initial `eddsa-jcs-2022` cryptosuite implementation.

It also adds public/internal Data Integrity exports and registers the Data Integrity module in the default agent module set, making Data Integrity APIs available by default.
