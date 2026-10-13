---
'@credo-ts/didcomm': patch
'@credo-ts/anoncreds': patch
---

`proofs.requestProof()` and `proofs.createRequest()` accept an optional `expiresTime`. When set, the request message carries the RFC 0032 `~timing.expires_time` decorator, for both present proof v1 and v2. It is set before the request is stored, so `findRequestMessage()` returns it too. The decorator is advisory: Credo does not act on it when receiving a request.

```ts
await agent.didcomm.proofs.requestProof({
  connectionId,
  protocolVersion: 'v2',
  proofFormats: { presentationExchange: { presentationDefinition } },
  expiresTime: new Date(Date.now() + 30 * 60 * 1000),
})
```
