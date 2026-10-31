---
'@credo-ts/didcomm': minor
---

Add the DCQL proof format for present-proof v2 (Aries RFC 0882). `DidCommDcqlProofFormatService` requests and presents `dc+sd-jwt` and `vc+sd-jwt` credentials with a DCQL query, over a connection or out of band without a handshake. The holder checks that the request `audience` names the verifier it answers to.

A request received without a connection that fails these checks is rejected without a problem report, because there is no connection to send it over.

`DidCommProofFormatService.processRequest` now takes `DidCommProofFormatProcessRequestOptions`, which adds a required `requestMessage`. Custom proof protocols that call `processRequest` on a format service must pass the request message.
