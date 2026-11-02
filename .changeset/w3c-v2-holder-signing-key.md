---
'@credo-ts/core': patch
---

When signing a W3C VCDM 2.0 JWT or SD-JWT presentation with a `holder`, the holder now throws a clear error if the credentials are bound to a key the holder DID does not control, or to more than one key, instead of signing a presentation the verifier rejects. A credential with a `cnf` the holder cannot resolve now also throws when signing. The presentation `kid` is now an absolute DID URL when the presentation has a `holder`.
