# Setup NodeJS

## Prerequisites

To start using Aries Framework JavaScript in NodeJS some platform specific dependencies are required.

1. Install [NodeJS](https://nodejs.org) (v12+) and [Python 3](https://www.python.org/downloads/)
2. Install [Libindy](https://github.com/hyperledger/indy-sdk) for your platform.
   - [macOS](../docs/libindy/macos.md)
   - [Linux](../docs/libindy/linux.md)
   - [Windows](../docs/libindy/windows.md)
3. Add `indy-sdk` and `aries-framework` to your project.

```bash
yarn add aries-framework indy-sdk   # npm install aries-framework indy-sdk
```

> ⚠️ If making use of NodeJS > 12, make sure you're also using indy-sdk >= 1.16.0-dev-1633

## Agent Setup

Initializing the Agent also requires some NodeJS specific setup, mainly for the Indy SDK and File System. Below is a sample config, see the [README](../README.md#getting-started) for an overview of getting started guides. If you want to jump right in, check the [Getting Started: Agent](./getting-started/0-agent.md) guide.

```ts
import { Agent } from 'aries-framework'

// Import indy-sdk and File System for NodeJS
import indy from 'indy-sdk'
import { NodeFileSystem } from 'aries-framework/build/storage/fs/NodeFileSystem'

// This creates an agent with all the specified configuration data
const agent = new Agent({
  label: 'my-agent',
  walletConfig: { id: 'walletId' },
  walletCredentials: { key: 'testkey0000000000000000000000000' },
  indy,
  fileSystem: new NodeFileSystem(),
})

// Make sure to initialize the agent before using it.
try {
  await agent.init()
  console.log('Initialized agent!')
} catch (error) {
  console.log(error)
}
```
