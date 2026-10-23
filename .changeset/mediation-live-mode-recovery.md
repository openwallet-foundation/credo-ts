---
'@credo-ts/didcomm': patch
---

The mediator reconnect loop no longer gives up when live mode setup fails after a reconnect. It closes the mediator socket with the new optional `closeSocketByConnectionId` outbound transport method and tries again with a jittered backoff that resets once a setup succeeds. `pickupMessages` with `awaitCompletion` now only completes on its own thread (its follow-up pickup messages carry `~thread`), `setLiveDeliveryMode` has an opt-in `awaitConfirmation`, and mediators only report `live_delivery` as true for the socket that holds the live session.
