# Setup Electron

<p style="text-align: center">⚠ Electron has not been tested in a production build, be cautious of errors ⚠</p>

To start using Electron, the same setup as NodeJS is required. Please follow the [NodeJS Prerequisites](./setup-nodejs.md#Prerequisites).

> At this point aries-framework and the indy-sdk are installed in your Electron project.

Because Electron is like a browser-environment, some additional work has to be done to get it working. The indy-sdk is used to make calls to `libindy`. Since `libindy` is not build for browser environments, a binding for the indy-sdk has to be created from the browser to the NodeJS environment in the `public/preload.js` file.

```ts
// public/Preload.js

const { contextBridge } = require('electron')
const indy = require('indy-sdk')
const NodeFileSystem = require('aries-framework/build/storage/fs/NodeFileSystem').NodeFileSystem

// fs is not available in the browser, so we initialize it in the main world
const fs = new NodeFileSystem()

// This exposes the indy sdk to the main world over a bridge
contextBridge.exposeInMainWorld('indy', indy)

// This exposes the NodeFileSystem to the main world over a bridge
contextBridge.exposeInMainWorld('fs', {
  write: fs.write,
  read: fs.read,
  exists: fs.exists,
  basePath: fs.basePath,
})
```

Now that indy is exposed in the main world, we can start using the framework on the browser side. Initializing the Agent requires some Electron specific setup, mainly for the Indy SDK and File System. Below is a sample config, see the [README](../README.md#getting-started) for an overview of getting started guides. If you want to jump right in, check the [Getting Started: Agent](./getting-started/0-agent.md) guide.

```ts
import { Agent } from 'aries-framework'
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
  // used custom indyWithErrorHandling created above
  indy: indyWithErrorHandling as unknown as typeof Indy,
  // Use fs exposed on window from main world
  fileSystem: window.fs,
})

// Here we try to initialize the agent for usage
try {
  await agent.init()
  console.log('Initialized agent!')
} catch (error) {
  console.log(error)
}
```
