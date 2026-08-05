---
"@credo-ts/openid4vc": patch
---

Consult the `getTrustedIssuersForVerification` callback for `did` signed OpenID4VC JWTs. Previously only `x5c` signed JWTs were checked against a trust list, meaning a signed authorization request (JAR), an OpenID4VCI key attestation, an OAuth2 client (wallet) attestation, or signed credential issuer metadata signed by any DID was accepted. Semantics now match `did` signed credentials in core: allowed when no callback is registered or it returns `undefined`, rejected when the signer DID is not in the returned list. Behavior for `x5c` signed JWTs is unchanged.
