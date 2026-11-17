---
'@credo-ts/didcomm': minor
---

Add the DCQL proof format for present-proof v2 (Aries RFC 0882). `DidCommDcqlProofFormatService` requests and presents `dc+sd-jwt` and `vc+sd-jwt` credentials with a DCQL query, over a connection, out of band without a handshake, or connectionless with a `~service`. The format is experimental and could have unexpected breaking changes. The holder checks that the request `audience` names the verifier it answers to.

A request received without a connection that fails these checks is rejected without a problem report, because there is no connection to send it over.

The verifier rejects a KB-JWT or `vp+sd-jwt` whose `iat` is older than the `maxPresentationAgeSeconds` constructor option (default 300) plus `validitySkewSeconds`.

Two limits come from core. A `vc+sd-jwt` with a `credentialStatus` is rejected, because Credo can't check W3C VC 2.0 status yet. A `vc+sd-jwt` can only be presented when the agent created the DID it signs with (its `credentialSubject.id`, or its `cnf.kid` DID when it has no subject).

`DidCommProofFormatService.processRequest` now takes `DidCommProofFormatProcessRequestOptions`, which adds a required `requestMessage`. Custom proof protocols that call `processRequest` on a format service must pass the request message.
