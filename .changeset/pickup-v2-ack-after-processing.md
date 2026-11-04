---
"@credo-ts/didcomm": minor
---

A message pickup v2 recipient now processes the messages of a delivery in order, in the agent context of the delivery, and only sends `messages-received` once they have been processed. Before, the acknowledgement was sent while the messages were still being processed, so the mediator could delete messages that were never handled if the agent stopped in between. Messages that can't be decrypted or parsed are still acknowledged, but a message whose processing fails is not, so the mediator delivers it again.

Delivery through pickup v2 is now at-least-once: if the agent stops after processing some messages of a delivery, they are delivered and processed again. Pickup v2 messages no longer go through the `DidCommMessageReceived` event, so its listeners don't see them and `processDidCommMessagesConcurrently` doesn't apply to them.

Added `DidCommMessageReceiver.receiveMessageAndReportFailure`, which emits a `DidCommMessageProcessingFailed` event instead of throwing when processing fails and returns whether the message was `processed`, `unreadable` or `failed`. `receiveMessage` accepts an `agentContext` to process the message in, instead of opening a new agent context session.
