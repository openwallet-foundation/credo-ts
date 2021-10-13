# Setup Electron

<p style="text-align: center">⚠ Electron has not been tested in a production build, be cautious of errors ⚠</p>

> If you run into any issues regarding this setup or using the agent afterwards, please open an issue [here](https://github.com/hyperledger/aries-framework-javascript/issues/new).

To start using Electron, the prerequisites of NodeJS are required. Please follow the [NodeJS Prerequisites](./setup-nodejs.md#Prerequisites).

> At this point it is assumed that you have a working electron project without Indy or Aries.

To add the aries framework and indy to your project execute the following:

```sh
yarn add @aries-framework/core @aries-framework/node indy-sdk

# Additional for typescript
yarn add --dev @types/indy-sdk
```

Because Electron is like a browser-environment, some additional work has to be done to get it working. The indy-sdk is used to make calls to `libindy`. Since `libindy` is not build for browser environments, a binding for the indy-sdk has to be created from the browser to the NodeJS environment in the `public/preload.js` file.

```ts
// public/preload.js

const { contextBridge } = require('electron')
const indy = require('indy-sdk')
const NodeFileSystem = require('@aries-framework/node').agentDependencies.FileSystem

const fs = new NodeFileSystem()

// Exposes indy to the main world
contextBridge.exposeInMainWorld('indy', indy)

// Exposes the filesystem, created by @aries-framework/node, to the main world
contextBridge.exposeInMainWorld('fs', {
  write: fs.write,
  read: fs.read,
  basePath: fs.basePath,
  exists: fs.exists,
})
```

This custom `preload.js` would also mean a slightly different `main.js`. It has to be stated that the exact security concerns of exposing this functionality to the `mainWorld` have not been researched extensively yet.

```ts
// public/main.js

const electron = require('electron')
const path = require('path')
const isDev = require('electron-is-dev')

const app = electron.app
const BrowserWindow = electron.BrowserWindow
let mainWindow

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })
  mainWindow.loadURL(isDev ? 'http://localhost:3000' : `file://${path.join(__dirname, '../build/index.html')}`)
  mainWindow.on('closed', () => (mainWindow = null))
}

app.allowRendererProcessReuse = false

app.on('ready', () => {
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
```

Now that indy is exposed in the main world, we can start using the framework on the browser side. Initializing the Agent requires some Electron specific setup, mainly for the Indy SDK and File System. Below is a sample config, see the [README](../README.md#getting-started) for an overview of getting started guides. If you want to jump right in, check the [Getting Started: Agent](./getting-started/0-agent.md) guide.

```ts
import { Agent, AriesFrameworkError, ConsoleLogger, FileSystem, IndySdkError, LogLevel } from '@aries-framework/core'
import fetch from 'electron-fetch'
import events from 'events'
import Indy from 'indy-sdk'
import nodeFetch from 'node-fetch'
import ws from 'ws'

// agentDependencies in the config requires filesystem to a class instance
class ElectronFileSystem implements FileSystem {
  basePath = window.fs.basePath
  exists = window.fs.exists
  read = window.fs.read
  write = window.fs.write
}

const wrapIndyCallWithErrorHandling = (func: any) => {
  return async (...args: any[]) => {
    try {
      return await func(...args)
    } catch (e) {
      if (e instanceof Error || e instanceof AriesFrameworkError || e instanceof IndySdkError) {
        const error = {
          name: 'IndyError',
          indyName: e.message,
          message: e.message,
          stack: e.stack,
        }
        throw error
      }
    }
  }
}

const indyWithErrorHandling = Object.fromEntries(
  Object.entries(window.indy).map(([funcName, funcImpl]) => [funcName, wrapIndyCallWithErrorHandling(funcImpl)])
)

export const setupAndInitializeAgent = async (label = 'test agent') => {
  // Electron specific agent dependencies
  const electronAgentDependencies = {
    indy: indyWithErrorHandling as unknown as typeof Indy,
    FileSystem: ElectronFileSystem,
    fetch: fetch as unknown as typeof nodeFetch,
    EventEmitterClass: events.EventEmitter,
    WebSocketClass: ws,
  }

  const agent = new Agent(
    { label, walletConfig: { id: label, key: label }, logger: new ConsoleLogger(LogLevel.test) },
    electronAgentDependencies
  )

  await agent.initialize()

  return agent
}
```

This might look like some complicated boilerplate, but it is all required for an agent to work completely.

Since we can not expose classes to the `mainWorld` from the `public/preload.js`, we have to create a class, here called `ElectronFileSystem` to use in our `agentDependencies`.

Since we expose indy which uses a custom Error class `IndySdkError` for handling errors, and we lose that with exposing it to the `mainWorld`, we have to add it back. This is done via the `indyWithErrorHandling() -> wrapIndyCallWithErrorHandling()`

All this configuration allows us to access all of the indy methods, allows the agent to access all of the indy methods correctly, allows the agent to access your filesystem for storage, etc. and most importantly it allows you to access the agent.
