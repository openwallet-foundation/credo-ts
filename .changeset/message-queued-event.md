---
"@credo-ts/didcomm": minor
---

Added a `DidCommMessagePickupEventTypes.MessageQueued` event, emitted with the connection id, recipient dids and message id whenever a message is added to the queue: by `DidCommMessagePickupApi.queueMessage`, by the mediator when it queues a forwarded message, and by the message sender when it queues a message for a connection with a queue service.

Added `DidCommMessagePickupApi.deliverQueuedMessagesToLiveSession`, which delivers the queued messages of a connection to its live mode session on this agent and ends the session when its transport fails. Together with the event, this lets agent instances that share a queue deliver messages queued by another instance, without each queue implementation emitting its own event.
