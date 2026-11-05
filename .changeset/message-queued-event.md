---
"@credo-ts/didcomm": minor
---

Live mode delivery of a forwarded message now delivers only that message, on the transport session of the live mode session, instead of the pending messages of the connection. When sending a live delivery fails, `deliverMessages` and `deliverMessagesFromQueue` end the live mode session and close its transport, and still throw the error.

`deliverMessagesFromQueue` and `takeFromQueue` accept a `messageIds` filter. `DidCommQueueTransportRepository` implementations must honor `messageIds` in `takeFromQueue`, otherwise live mode delivers other pending messages too.

`DidCommMessagePickupApi.queueMessage` now returns `{ messageId }` instead of `undefined` (`QueueMessageReturnType`), which affects implementations and mocks of `DidCommMessagePickupApi`.
