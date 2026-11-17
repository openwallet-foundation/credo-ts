---
'@credo-ts/core': patch
'@credo-ts/didcomm': patch
'@credo-ts/node': patch
'@credo-ts/openid4vc': patch
---

Add a `waitUntil` option to the agent config for serverless platforms that stop the CPU once a response is sent. Credo passes it the work it starts but doesn't await. This covers:

- async event listeners
- the processing of received DIDComm messages
- out-of-band request messages that wait for the connection
- ending an OpenID4VC request session, handed over when the request starts as the router ends it after the response

How to implement `waitUntil` depends on the platform you deploy to. Some platforms keep work running after the response has been sent: pass [`ctx.waitUntil`](https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil) on Cloudflare Workers, [`waitUntil`](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#waituntil) on Vercel, or [`after`](https://nextjs.org/docs/app/api-reference/functions/after) in Next.js as `(promise) => after(() => promise)`. On other platforms, such as Google Cloud Run, track the promises per request with [`AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage) and wait for them before responding. That holds up the response, so keep the work it waits for short, such as publishing an event to a pub/sub channel, and do the heavy processing elsewhere.

A failing async event listener is now logged instead of causing an unhandled rejection. `EventEmitter.emit` now returns a promise that resolves once the async listeners have settled. It never rejects, and awaiting it is optional. Credo now calls the listeners itself, so `agentDependencies.EventEmitterClass` only needs `on`, `off` and `listeners` (the new `EventEmitterLike` interface), and an `emit` override on it is no longer called. Received DIDComm messages are still processed one at a time by default, and each one now runs in the async context it was received in.

`DidCommHttpInboundTransport` has a new `respondAfterProcessing` option. With it, the transport only responds once a message has been processed, also when no response message is sent over the request. When processing a message fails, the transport now responds with a 500 straight away, instead of after `processedMessageListenerTimeoutMs`.
