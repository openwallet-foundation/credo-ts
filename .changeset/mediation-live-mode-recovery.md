---
'@credo-ts/didcomm': minor
---

Live mode pickup now checks the mediator by default. Every 30 seconds the recipient sends a `status-request` over the live socket, and it reconnects when there is no reply or the mediator says live delivery is off for that socket. Setting up live mode now also waits for the mediator to confirm it. A mediator that never answers the `live-delivery-change` gets one `status-request` instead, which makes setup up to 10 seconds slower with it. Set the new `liveModeCheckIntervalMs` option to 0 to turn all of this off, for example with a mediator that does not thread its status replies or when several agents share one mediator connection. The checks need an outbound transport with the new optional `closeSocketByConnectionId` method (`DidCommWsOutboundTransport` has it).

When live mode setup fails to send or gets no reply, `initiateMessagePickup` now closes the mediator socket and retries instead of rejecting. A pickup timeout before live mode no longer rejects it either. It still rejects when the mediator replies that live delivery is off. `setLiveDeliveryMode` has a new `awaitConfirmation` option. The reconnect delay now has jitter, and `maximumMediatorReconnectionIntervalMs` defaults to 30 seconds instead of no limit.

Mediators now set `live_delivery` in status replies to true only for the socket that holds the live session. Once recipients upgrade, each live mode recipient sends them a `status-request` every 30 seconds.
