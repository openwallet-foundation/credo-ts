---
'@credo-ts/core': patch
---

DCQL now only reports cryptographic holder binding for credentials that are bound to a key or to their subject, so presentations of credentials without holder binding are rejected unless the credential query sets `require_cryptographic_holder_binding: false`. Wallets no longer offer such credentials for queries that require holder binding. The Credo OpenID4VP verifier still rejects queries that set `require_cryptographic_holder_binding: false`, so it can't accept credentials without holder binding yet. This only applies to other verifiers and to the wallet side.
