---
'@credo-ts/core': minor
'@credo-ts/didcomm': minor
'@credo-ts/node': minor
'@credo-ts/webvh': minor
---

HTTP requests now have a response size limit and a timeout, so a malicious server can't exhaust memory or keep a request open. The agent wraps `agentDependencies.fetch` with the new `fetchLimits` agent config, which defaults to 10 MiB and 30 seconds. This also covers requests that libraries make with it, such as OpenID4VC and mdoc requests. A response over the limit is aborted and its request fails.

These options override `maxResponseBytes` for specific requests:

- `maxTypeMetadataBytes` on `SdJwtVcModule` for type metadata.
- `maxStatusListBytes` on the new `TokenStatusListModule` config for status lists of Token Status Lists, SD-JWT VCs and mdocs.
- `maxDidDocumentBytes` on `WebDidResolver`.
- `maxResourceBytes` on `WebVhDidResolver`.
- `maxResponseBytes` on `DidCommHttpOutboundTransport`.
- `maxInvitationBytes` on `DidCommModule` for short URL invitations.

`DidCommWsInboundTransport` now limits received messages to 5 MiB, configurable with `maxPayloadBytes`.
