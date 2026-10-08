---
'@credo-ts/didcomm': minor
'@credo-ts/node': minor
---

Move the DIDComm HTTP and WebSocket inbound transports from `@credo-ts/node` to `@credo-ts/didcomm`. Configure explicit inbound and outbound transport instances through `DidCommModule`'s `transports.inbound` and `transports.outbound` arrays. The legacy inbound transport exports in `@credo-ts/node` have been removed; migrate to the DIDComm transports with `httpServerHost({ port })`, `expressHost({ app })` from `@credo-ts/node/express`, or `webSocketHost({ port })` / `webSocketHost({ server })` for Node hosting.

Harden inbound transport lifecycle across restarts and initialization failures. Credo-owned HTTP listeners can be shared by multiple bindings, close after the last binding detaches, and have bounded shutdown when uploads stall. Caller-provided WebSocket servers remain open when the agent stops; connections received while no acceptor is attached are closed with code 1013.
