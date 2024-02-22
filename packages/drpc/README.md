<p align="center">
  <br />
  <img
    alt="Credo Logo"
    src="https://github.com/openwallet-foundation/credo-ts/blob/c7886cb8377ceb8ee4efe8d264211e561a75072d/images/credo-logo.png"
    height="250px"
  />
</p>
<h1 align="center"><b>Credo DRPC Module</b></h1>
<p align="center">
  <a
    href="https://raw.githubusercontent.com/openwallet-foundation/credo-ts/main/LICENSE"
    ><img
      alt="License"
      src="https://img.shields.io/badge/License-Apache%202.0-blue.svg"
  /></a>
  <a href="https://www.typescriptlang.org/"
    ><img
      alt="typescript"
      src="https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg"
  /></a>
    <a href="https://www.npmjs.com/package/@credo-ts/question-answer"
    ><img
      alt="@credo-ts/question-answer version"
      src="https://img.shields.io/npm/v/@credo-ts/question-answer"
  /></a>

</p>
<br />

DRPC module for [Credo](https://github.com/openwallet-foundation/credo-ts.git). Implements [Aries RFC 0804](https://github.com/hyperledger/aries-rfcs/blob/ea87d2e37640ef944568e3fa01df1f36fe7f0ff3/features/0804-didcomm-rpc/README.md).

### Quick start

In order for this module to work, we have to inject it into the agent to access agent functionality. See the example for more information.

### Example of usage

```ts
import { DrpcModule } from '@credo-ts/drpc'

const agent = new Agent({
  config: {
    /* config */
  },
  dependencies: agentDependencies,
  modules: {
    drpc: new DrpcModule(),
    /* other custom modules */
  },
})

await agent.initialize()

// Send a request to the specified connection
const responseListener = await senderAgent.modules.drpc.sendRequest(connectionId, {
  jsonrpc: '2.0',
  method: 'hello',
  id: 1,
})

// Listen for any incoming requests
const { request, sendResponse } = await receiverAgent.modules.drpc.recvRequest()

// Process the received request and create a response
const result =
  request.method === 'hello'
    ? { jsonrpc: '2.0', result: 'Hello world!', id: request.id }
    : { jsonrpc: '2.0', error: { code: DrpcErrorCode.METHOD_NOT_FOUND, message: 'Method not found' } }

// Send the response back
await sendResponse(result)
```
