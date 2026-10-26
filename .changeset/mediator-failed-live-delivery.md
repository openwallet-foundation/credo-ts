---
'@credo-ts/didcomm': patch
---

With `QueueAndLiveModeDelivery`, a failed live delivery no longer fails the forward, because the message is already queued. When sending the delivery fails, the mediator closes the transport of that live mode session, so the recipient reconnects and picks the message up. `InMemoryQueueTransportRepository` now puts the messages it handed out for a connection back in the queue when that connection's live mode session ends, so the next pickup delivers them. `deliverMessagesFromQueue` no longer takes messages for a live mode session that ended while it loaded the connection.
