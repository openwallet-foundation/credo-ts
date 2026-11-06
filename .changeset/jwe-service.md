---
"@credo-ts/core": patch
"@credo-ts/openid4vc": patch
---

Added a `JweService` next to the `JwsService`. It creates compact and general JSON JWEs with `ECDH-ES`, `ECDH-ES+A128KW`/`A192KW`/`A256KW` and `ECDH-1PU+A256KW`, and sets `alg`, `enc`, `apu`, `apv` and `epk` in the protected header from the same values the KMS uses for key derivation. Decryption parses compact or general JSON JWEs, uses the received protected header as AAD and selects the recipient by `kid`.

The OpenID4VC JWE encrypt and decrypt callbacks now use the `JweService`.
