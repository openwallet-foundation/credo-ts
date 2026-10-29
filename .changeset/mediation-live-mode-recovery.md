---
'@credo-ts/didcomm': patch
---

The mediator reconnect loop no longer gives up when live mode setup fails after a reconnect. It closes the mediator socket with the new optional `closeSocketByConnectionId` outbound transport method and tries again with a jittered backoff that resets once a setup succeeds. This also applies when the queued messages cannot be fully retrieved within the pickup timeout: the socket is closed and the next attempt continues with the remaining messages. `pickupMessages` with `awaitCompletion` now only completes on its own thread (its follow-up pickup messages carry `~thread`), so it will time out against a mediator that does not thread its `status` or `batch` replies. `setLiveDeliveryMode` has an opt-in `awaitConfirmation`, and mediators only report `live_delivery` as true for the socket that holds the live session.
