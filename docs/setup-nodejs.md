# Setup NodeJS

## Prerequisites

To start using Aries Framework JavaScript in NodeJS some platform specific dependencies are required.

1. Install [NodeJS](https://nodejs.org) (v14+, 16+ LTS recommended) and [Python 3](https://www.python.org/downloads/)
2. Install [Libindy](https://github.com/hyperledger/indy-sdk) for your platform.
   - [macOS with Apple Silicon](../docs/libindy/macos-apple.md)
   - [macOS with Intel](../docs/libindy/macos-intel.md)
   - [Linux](../docs/libindy/linux.md)
   - [Windows](../docs/libindy/windows.md)
3. Add `@aries-framework/core` and `@aries-framework/node` to your project.

## Installing dependencies

```bash
yarn add @aries-framework/core @aries-framework/node
```

Right now, as a patch that will later be changed, some platforms will have an "error" when installing the dependencies. This is because the BBS signatures library that we use is built for Linux x86 and MacOS x86 (and not Windows and MacOS arm). This means that it will show that it could not download the binary.
This is not an error, as the library that fails is `node-bbs-signaturs` and is an optional dependency for perfomance improvements. It will fallback to a, slower, wasm build.

## Agent Setup

Initializing the Agent also requires some NodeJS specific setup, mainly for the Indy SDK and File System. Below is a sample config, see the [README](../README.md#getting-started) for an overview of getting started guides. If you want to jump right in, check the [Getting Started: Agent](./getting-started/0-agent.md) guide.

```ts
import { Agent } from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'

// This creates an agent with all the specified configuration data
const agent = new Agent(
  {
    label: 'my-agent',
    walletConfig: {
      id: 'walletId',
      key: 'testkey0000000000000000000000000',
    },
  },
  agentDependencies
)

// Make sure to initialize the agent before using it.
try {
  await agent.initialize()
  console.log('Initialized agent!')
} catch (error) {
  console.log(error)
}
```
