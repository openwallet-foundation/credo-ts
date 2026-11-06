---
'@credo-ts/openid4vc': patch
---

Reject wallet attestations (`oauth-client-attestation+jwt`) and key attestations (`key-attestation+jwt`) signed with a `jwk` header. A `jwk` signer can't be checked against the trusted issuers, so a client could sign its own attestation and pass verification. For wallet attestations this meant an issuer that requires them accepted any client, and for key attestations any claimed `key_storage` and `user_authentication` level was accepted. Wallet and key attestations must be signed with `x5c` or `did`. The `typ` header is now matched case-insensitively and with or without the `application/` prefix, also when deciding which trusted issuers verification applies.
