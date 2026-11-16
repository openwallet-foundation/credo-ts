---
'@credo-ts/core': minor
'@credo-ts/askar': patch
'@credo-ts/node': patch
'@credo-ts/didcomm': patch
'@credo-ts/cheqd': patch
'@credo-ts/indy-vdr': patch
'@credo-ts/hedera': patch
'@credo-ts/webvh': patch
'@credo-ts/react-native': patch
---

`KeyManagementApi.sign` requires a new `expectedPublicJwk` option and only returns the signature if the key and algorithm match it. Pass `null` for symmetric keys or when the public key isn't known. This breaks direct `sign` callers. Credo passes the key where the signer has it: a JWS with an `x5c` or `jwk` header, COSE Sign1, linked data proofs, Data Integrity, SD-JWT, DIDComm signature decorators, and the cheqd, Indy VDR, Hedera and webvh DID signers. An mdoc or CWT status list signed with a key that doesn't match its certificate now fails. The key is checked before it signs. If the API already read the key to find its backend, it checks it there. Otherwise it passes `expectedPublicJwk` to the backend, which must check the key before signing and return it as `publicJwk`. `KmsSignOptions` now requires `expectedPublicJwk`, which is `null` when the backend doesn't need to check. Custom backends need to add the check, for example with `assertExpectedSigningKey`. Askar, Node and the secure environment backend do. Askar no longer exports the private key when signing.
