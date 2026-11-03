---
"@credo-ts/didcomm": minor
---

Added a `DidCommEventTypes.DidCommMessageQueued` event, emitted with the connection id, recipient dids and message id whenever a message is added to the queue through `DidCommMessageSender.queueMessage`. `DidCommMessagePickupApi.queueMessage`, the mediator and the message sender all queue through it.

Added `DidCommMessagePickupApi.deliverQueuedMessagesToLiveSession`, which delivers the queued messages of a connection to its live mode session on this agent and ends the session when its transport fails. The agent that queues a message already delivers it to its own live mode session, so a `DidCommMessageQueued` listener should only forward the event to other agent instances that share the queue, which then call `deliverQueuedMessagesToLiveSession`.
