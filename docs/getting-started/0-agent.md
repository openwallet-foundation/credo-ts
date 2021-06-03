# Agent

The Agent is the base component to use in Aries Framework JavaScript. It builds on the concept of an agent as described in [Aries RFC 0004: Agents](https://github.com/hyperledger/aries-rfcs/blob/master/concepts/0004-agents/README.md).

Before initializing your agent, make sure you have followed the setup guide for your platform and environment:

- [Electron](./../setup-electron.md)
- [NodeJS](./../setup-nodejs.md)
- [React Native](./../setup-react-native.md)

## Setting Up Your Agent

You can set up an agent by importing the `Agent` class. It requires you to pass in a JSON object to configure the agent. The following is an example with only the required configuration options specified. The agent by itself can't do much yet, we need [transports](1-transports.md) to be able to interact with other agents.

```ts
import indy from 'indy-sdk'
import { NodeFileSystem } from 'aries-framework/build/src/storage/fs/NodeFileSystem'

import { Agent, InitConfig } from 'aries-framework'

const agentConfig: InitConfig = {
  // The label is used for communication with other
  label: 'My Agent',
  walletConfig: { id: 'walletId' },
  walletCredentials: { key: 'testKey0000000000000000000000000' },
  indy,
}

const agent = new Agent(agentConfig)
```

## Configuration Options

The agent currently supports the following configuration options. Fields marked with a **\*** are required. Other parts of this documentation go into more depth on the different configuration options.

- `label`\*: The label to use for invitations.
- `walletConfig`\*: The wallet config to use for creating and unlocking the wallet
- `walletCredentials`\*: The wallet credentials to use for creating and unlocking the wallet
- `indy`\*: The indy sdk to use for indy operations. This is different for NodeJS / React Native
- `fileSystem`\*: The file system instance used for reading and writing files.
- `host`: The host to use for invitations.
- `post`: The port to append to host for invitations.
- `endpoint`: The endpoint (host + port) to use for invitations. Has priority over `host` and `port.
- `publicDidSeed`: The seed to use for initializing the public did of the agent. This does not register the DID on the ledger.
- `mediatorUrl`: The url of the mediator to use for inbound routing
- `autoAcceptConnections`: Whether to auto accept all incoming connections. Default false
- `genesisPath`: The path to the genesis file to use for connecting to an Indy ledger.
- `genesisTransactions`: String of genesis transactions to use for connecting to an Indy ledger.
- `poolName`: The name of the pool to use for the specified `genesisPath`. Default `default-pool`
- `logger`: The logger instance to use. Must implement `Logger` interface
- `didCommMimeType`: The mime-type to use for sending and receiving messages.
  - `DidCommMimeType.V0`: "application/ssi-agent-wire"
  - `DidCommMimeType.V1`: "application/didcomm-envelope-enc"
