---
'@credo-ts/didcomm': minor
'@credo-ts/core': patch
'@credo-ts/openid4vc': patch
---

Add the DCQL proof format for present-proof v2 (Aries RFC 0882). `DidCommDcqlProofFormatService` requests and presents `dc+sd-jwt` and `vc+sd-jwt` credentials with a DCQL query, over a connection or out of band without a handshake. The holder checks that the request `audience` is the DID of the verifier it answers to.

W3C v2 SD-JWT presentations created by `W3cV2SdJwtCredentialService` now include `iat`, and the ones created by the `DcqlService` include the `undefined-terms/v2` context. The OpenID4VP holder rejects authorization requests whose `client_id` starts with `didcomm:`.
