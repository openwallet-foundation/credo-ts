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

The download stops at the limit when the `fetch` in the agent dependencies exposes the response body as a stream. On React Native, recent Expo versions use `expo/fetch` as the global fetch, which supports this. React Native's built-in fetch doesn't: it only returns a response after the whole body is downloaded. A response over the limit then still fails, but it doesn't protect memory. We recommend `expo/fetch`, or another fetch implementation that supports streaming.

When `DidCommWsInboundTransport` creates the server from `port`, it now limits received messages to 5 MiB, the same as `DidCommHttpInboundTransport`. Before, the limit was 100 MiB, the default of `ws`. A larger message now closes the socket. Agents that receive larger messages, for example a mediator receiving `forward` messages with large attachments, can raise the limit with the new `maxPayloadBytes` option. When you pass your own `server`, set `maxPayload` on it yourself.
