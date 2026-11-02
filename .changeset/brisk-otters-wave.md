---
'@credo-ts/core': minor
'@credo-ts/didcomm': minor
'@credo-ts/node': minor
---

Move the built-in DIDComm HTTP and WebSocket inbound transports from
`@credo-ts/node` to `@credo-ts/didcomm`. Import `DidCommHttpInboundTransport`
and `DidCommWsInboundTransport` from `@credo-ts/didcomm`; `@credo-ts/node` no
longer exports them and no longer depends on `@credo-ts/didcomm` or `rxjs`.
Configure inbound and outbound transport instances in `DidCommModule`'s
`transports.inbound` and `transports.outbound` arrays, or register them with
`agent.didcomm.registerInboundTransport` and
`agent.didcomm.registerOutboundTransport` before agent initialization.
Transport instances are no longer created implicitly. Node applications can
pass `httpServerHost` from `@credo-ts/node/http` or `webSocketHost` from
`@credo-ts/node/websocket` for Credo-owned listeners, or `expressHost` from
`@credo-ts/node/express` to attach an application-owned Express app.

Harden inbound lifecycle: transports using the same `httpServerHost` share its
listener, which closes after the last transport stops, and DIDComm sessions
close before detaching. Bound shutdown of owned HTTP listeners even when
requests stall while uploading. Applications retain ownership of servers they
supply.

Expose framework-neutral HTTP handlers (`agent.didcomm.httpHandlers`) and a
WebSocket acceptor (`agent.didcomm.webSocketAcceptor`) from DIDComm for other
runtimes to mount. Export Fetch-based HTTP and standard-shaped WebSocket
contracts from `@credo-ts/core/http` and `@credo-ts/core/websocket`, without
adding Express or Node WebSocket dependencies to core or DIDComm.
