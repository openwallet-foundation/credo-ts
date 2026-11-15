---
'@credo-ts/core': minor
'@credo-ts/askar': patch
'@credo-ts/node': patch
'@credo-ts/didcomm': patch
'@credo-ts/cheqd': patch
'@credo-ts/indy-vdr': patch
'@credo-ts/hedera': patch
'@credo-ts/webvh': patch
---

`KeyManagementApi.sign` requires a new `expectedPublicJwk` option and only returns the signature if the key and algorithm match it. Pass `null` for symmetric keys or when the public key isn't known. This breaks direct `sign` callers. Credo passes the key where the signer has it: a JWS with an `x5c` or `jwk` header, COSE Sign1, linked data proofs, Data Integrity, SD-JWT, DIDComm signature decorators, and the cheqd, Indy VDR, Hedera and webvh DID signers. An mdoc or CWT status list signed with a key that doesn't match its certificate now fails. Backends can return the new optional `publicJwk` from `sign` to skip a key read, as Askar and Node do. Askar no longer exports the private key when signing.
