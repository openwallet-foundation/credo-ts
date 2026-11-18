---
'@credo-ts/core': patch
---

Update `@sd-jwt/*` to `^0.24.3` and `@owf/*` to `^0.7.0` (`@owf/mdoc` to `^0.9.3`).

- SD-JWT VC verification now rejects credentials where `iss`, `nbf`, `exp`, `cnf`, `vct`, `vct#integrity` or `status`, or one of their sub-claims, is selectively disclosable. The SD-JWT VC spec forbids this. Signing with a disclosure frame for a sub-claim of these claims now throws.
- SD-JWT VC verification rejects an issuer-signed JWT or Key Binding JWT with a `crit` header.
- mdoc verification accepts the fully-specified COSE algorithms of RFC 9864 (`ESP256`, `ESP384`, `ESP512`, `Ed25519` and `Ed448`), and rejects a signature whose key type or curve does not match its algorithm.
