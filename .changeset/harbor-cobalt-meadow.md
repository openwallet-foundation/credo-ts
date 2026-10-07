---
'@credo-ts/didcomm': patch
---

Emit `DidCommMessageProcessingFailed` when an inbound message received through the DIDComm event path cannot be processed.

```ts
agent.events.on<DidCommMessageProcessingFailedEvent>(
  DidCommEventTypes.DidCommMessageProcessingFailed,
  ({ payload }) => {
    // payload.error, payload.message, payload.connection, payload.contextCorrelationId, payload.receivedAt
  }
)
```
