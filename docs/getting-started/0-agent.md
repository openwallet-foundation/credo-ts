# Agent

The Agent is the base component to use in Aries Framework JavaScript. It builds on the concept of an agent as described in [Aries RFC 0004: Agents](https://github.com/hyperledger/aries-rfcs/blob/master/concepts/0004-agents/README.md).

Before initializing your agent, make sure you have followed the setup guide for your platform and environment:

- [Electron](../setup-electron.md)
- [NodeJS](../setup-nodejs.md)
- [React Native](../setup-react-native.md)

## Setting Up Your Agent

You can set up an agent by importing the `Agent` class. It requires you to pass in a JSON object to configure the agent. The following is an example with only the required configuration options specified. The agent by itself can't do much yet, we need [transports](1-transports.md) to be able to interact with other agents.

```ts
import { Agent, InitConfig } from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'

const agentConfig: InitConfig = {
  // The label is used for communication with other
  label: 'My Agent',
  walletConfig: {
    id: 'walletId',
    key: 'testKey0000000000000000000000000',
  },
}

const agent = new Agent(agentConfig, agentDependencies)
```

## Configuration Options

The agent currently supports the following configuration options. Fields marked with a **\*** are required. Other parts of this documentation go into more depth on the different configuration options.

- `label`\*: The label to use for invitations.
- `walletConfig`: The wallet config to use for creating and unlocking the wallet. Not required, but requires extra setup if not passed in constructor
- `endpoint`: The endpoint (schema + host + port) to use for invitations.
- `publicDidSeed`: The seed to use for initializing the public did of the agent. This does not register the DID on the ledger.
- `genesisPath`: The path to the genesis file to use for connecting to an Indy ledger.
- `genesisTransactions`: String of genesis transactions to use for connecting to an Indy ledger.
- `poolName`: The name of the pool to use for the specified `genesisPath`. Default `default-pool`
- `logger`: The logger instance to use. Must implement `Logger` interface
- `didCommMimeType`: The mime-type to use for sending and receiving messages.
  - `DidCommMimeType.V0`: "application/ssi-agent-wire"
  - `DidCommMimeType.V1`: "application/didcomm-envelope-enc"
- `autoAcceptMediationRequests` - As a mediator, whether to auto accept mediation requests. If not enabled requests should be accepted manually on the mediator module
- `mediationConnectionsInvitation` - Connection invitation to use for default mediator. If specified the agent will create a connection, request mediation and store the mediator as default for all connections.
- `defaultMediatorId` - Mediator id to use as default mediator. Use this if you want to override the currently default mediator.
- `clearDefaultMediator` - Will clear the default mediator
- `autoAcceptConnections`: Whether to auto accept all incoming connections. Default false
- `autoAcceptProofs`: Whether to auto accept all incoming proofs:
  - `AutoAcceptProof.Always`: Always auto accepts the proof no matter if it changed in subsequent steps
  - `AutoAcceptProof.ContentApproved`: Needs one acceptation and the rest will be automated if nothing changes
  - `AutoAcceptProof.Never`: Default. Never auto accept a proof
- `autoAcceptCredentials`: Whether to auto accept all incoming proofs:
  - `AutoAcceptCredential.Always`: Always auto accepts the credential no matter if it changed in subsequent steps
  - `AutoAcceptCredential.ContentApproved`: Needs one acceptation and the rest will be automated if nothing changes
  - `AutoAcceptCredential.Never`: Default. Never auto accept a credential
