# Setup Electron

<p style="text-align: center">⚠ Electron has not been tested in a production build, be cautious of errors ⚠</p>

To start using Electron some depencies are required. Please follow the [prerequisites](./setup-nodejs.md#Prerequisites) for this.

> At this point aries-framework and the indy-sdk are installed in your Electron project.


Because Electron is like a browser-environment, some additional work has to be done to get it working. The indy-sdk is used to make calls to `Libindy`. Since browsers can not do this, a binding has to be created in the `public/preload.js`.

```ts
// public/Preload.js

const { contextBridge } = require('electron')
const indy = require('indy-sdk')
const NodeFileSystem =
  require('aries-framework/build/src/storage/fs/NodeFileSystem').NodeFileSystem

const fs = new NodeFileSystem()

// This exposes the indy sdk to the mainworld over a bridge
contextBridge.exposeInMainWorld('indy', indy)

// This exposes the NodeFileSystem to the mainworld over a bridge
contextBridge.exposeInMainWorld('fs', {
  write: fs.write,
  read: fs.read,
  exists: fs.exists,
  basePath: fs.basePath,
})
```

Now that indy is exposed in the mainworld, we have get our error-handling back use the exposed indy-sdk. Initializing the Agent also requires some Electron specific setup, mainly for the Indy SDK and File System. Below is a sample config, see the [Docs](./README.md) for an overview of getting started guides. If you want to jump right in, check the [Getting Started: Agent](./getting-started/0-agent.md) guide.

```ts
// src/agent.ts

import { Agent } from 'aries-framework'
import { NodeFileSystem } from 'aries-framework/build/src/storage/fs/NodeFileSystem'
import type Indy from 'indy-sdk'

// Here we add indy and fs to our window (on window we can access the exposed libraries)
declare global {
  interface Window {
    indy: typeof Indy
    fs: FileSystem
  }
}

// This function adds error-handling with the indy-sdk
function wrapIndyCallWithErrorHandling(func: any) {
  return async (...args: any[]) => {
    try {
      return await func(...args)
    } catch (e) {
      e.name = 'IndyError'
      e.indyName = e.message
      throw e
    }
  }
}

// This adds the error-handling to each function
const indyWithErrorHandling = Object.fromEntries(
  Object.entries(window.indy).map(([funcName, funcImpl]) => [funcName, wrapIndyCallWithErrorHandling(funcImpl)])
)

// This creates an agent with all the specified configuration data
const agent = new Agent({
  label: 'my-agent',
  walletConfig: { id: 'walletId' },
  walletCredentials: { key: 'testkey0000000000000000000000000' },
  indy: indyWithErrorHandling as unknown as typeof Indy,
  fileSystem: new NodeFileSystem()
})

// Here we try to initialize the agent for usage
try {
  await agent.init()
  console.log('Initialized agent!')
} catch(error) {
  console.log(error)
}
```