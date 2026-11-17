<h1 align="center"><b>Serverless samples</b></h1>

Serverless platforms can stop the CPU once a response has been sent. Credo starts some work without awaiting it, such as async event listeners and the processing of received DIDComm messages. The `waitUntil` option of the agent config receives that work, so it isn't cut off.

These samples run a server agent with listeners that take a second, standing in for calling a webhook. They run when a basic message comes in over DIDComm, and when the OpenID4VC issuer has issued a credential.

- `express.ts` holds the response until the work has finished. Use this on platforms that stop the CPU after the response, such as Google Cloud Run with request-based billing. Each request keeps the promises passed to `waitUntil` in an [`AsyncLocalStorage`](https://nodejs.org/api/async_context.html#class-asynclocalstorage), and a middleware waits for them before it sends the response. It runs DIDComm and an OpenID4VC issuer.
- `nextjs` responds right away and continues the work in [`after`](https://nextjs.org/docs/app/api-reference/functions/after). On Vercel or Cloudflare Workers, pass their `waitUntil` the same way. It runs DIDComm.

`didcomm-client.ts` connects to a server and sends it a basic message. `openid4vc-client.ts` receives a credential from the Express server with the pre-authorized code flow.

## Run

For environment setup, make sure you followed the [Credo prerequisites](https://credo.js.org/guides/getting-started/prerequisites). Start one of the servers, then run a client in a second terminal:

```sh
pnpm express # or: pnpm nextjs
pnpm client:didcomm # or, with the Express server: pnpm client:openid4vc
```

The servers log the time since the request came in. With the Express server, the request that triggers a listener is answered once the listener is done:

```
[request 6 +9ms] listener: issued a credential, calling the webhook
[request 6 +9ms] POST /oid4vci/<issuer id>/credential ready to respond with 200, waiting for the work Credo started
[request 6 +1011ms] listener: webhook called
[request 6 +1011ms] POST /oid4vci/<issuer id>/credential responded after waiting 1002ms for 3 promise(s)
```

The client logs `the server responded with 1 credential(s) after 1038ms`, or for the basic message `the server responded to the basic message after 1016ms`.

With the Next.js server, the response comes first, and the listener finishes after it:

```
[request 3 +0ms] POST / responded with 202, the message is processed after the response
[request 3 +9ms] listener: received "Hello from the client", calling the webhook
[request 3 +1010ms] listener: webhook called
```

The client logs `the server responded to the basic message after 13ms`. The dev server keeps running after a response, so locally the work would also finish without `after`. On a serverless platform it would not.

Holding the response makes the client wait, so keep the work short when you do that, for example by publishing an event to a queue and doing the heavy work elsewhere.

## Holding the response in Express

Express has no hook that runs before a response is sent, and the DIDComm and OpenID4VC routes belong to Credo. So the middleware wraps `res.end`, as `express-session` does to save the session before responding. It sends the status and headers straight away and holds only the body: Credo's OpenID4VC routes call `next()` after responding, and Express answers with a 404 when the headers haven't been sent by then.

## Next.js in this repository

The Next.js sample compiles Credo from source, as the packages in this repository export their TypeScript. That's why `tsconfig.json` enables legacy decorators and turns off `useDefineForClassFields`, and why the sample runs on webpack: Turbopack ignores `useDefineForClassFields`.
