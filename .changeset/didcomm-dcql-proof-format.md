---
'@credo-ts/didcomm': minor
'@credo-ts/core': patch
'@credo-ts/openid4vc': patch
---

Add the DCQL proof format for present-proof v2 (Aries RFC 0882). `DidCommDcqlProofFormatService` requests and presents `dc+sd-jwt` and `vc+sd-jwt` credentials with a DCQL query, over a connection or out of band without a handshake. The holder checks that the request `audience` is the DID of the verifier it answers to.

A request received without a connection that fails these checks is rejected without a problem report, because there is no connection to send it over.

`DidCommProofFormatService.processRequest` now takes `DidCommProofFormatProcessRequestOptions`, which adds a required `requestMessage`. Custom proof protocols that call `processRequest` on a format service must pass the request message.

W3C v2 SD-JWT presentations created by `W3cV2SdJwtCredentialService` now include `iat`, and the ones created by the `DcqlService` include the `undefined-terms/v2` context. The OpenID4VP holder rejects authorization requests whose `client_id` starts with `didcomm:`.

W3C v2 SD-JWT credentials can no longer make `issuer`, `validFrom` or `validUntil` selectively disclosable.
