---
'@credo-ts/core': minor
---

Signing a W3C VCDM 2.0 JWT or SD-JWT presentation now picks the signer with the same rules the verifier checks. The signer DID is the `holder`, else the shared `credentialSubject.id`, else the `cnf.kid` DID, and it must be the `holder`, a `credentialSubject.id` of every credential that has one, and the DID of every `cnf.kid`. The key is the `cnf` key, else the single local `authentication` key, and must be a local `authentication` key of that DID. Signing now throws a clear error when these can't all be met, instead of signing a presentation the verifier rejects. The presentation `kid` is now always an absolute DID URL. A credential bound only with `cnf.jwk` now needs a `holder` or `credentialSubject.id` DID to be presented. Verifying a presentation now also requires the DID of a credential's `cnf.kid` to be the DID that signed the presentation.
