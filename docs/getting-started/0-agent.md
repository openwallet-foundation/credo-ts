# Agent

The Agent is the base component to use in Aries Framework JavaScript. It builds on the concept of an agent as described in [Aries RFC 0004: Agents](https://github.com/hyperledger/aries-rfcs/blob/master/concepts/0004-agents/README.md).

Before initializing your agent, make sure you have followed the setup guide for your platform and environment:

- [Electron](../setup-electron.md)
- [NodeJS](../setup-nodejs.md)
- [React Native](../setup-react-native.md)

## Setting Up Your Agent

> Note: This setup is assumed for a react native mobile agent
> Other platforms: To do

You can set up an agent by importing the `Agent` class. It requires you to pass in a JSON object to configure the agent. The following is an example with only the required configuration options specified. The agent by itself can't do much yet, we need [transports](1-transports.md) to be able to interact with other agents.

```ts
import { Agent, InitConfig } from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'

const agentConfig: InitConfig = {
  // The label is used for communication with other agents
  label: 'My Agent',
  walletConfig: {
    id: 'walletId',
    key: 'testKey0000000000000000000000000',
  },
}

const agent = new Agent(agentConfig, agentDependencies)
```

## Complete Agent Initialization

This is the optimal initialization code for a scenario where complete functionality is needed.
We will walk through the following steps to initialize the agent with full capabilities.

### 1 - Import statements

```ts
import {
  Agent,
  AutoAcceptCredential,
  ConnectionEventTypes,
  ConnectionInvitationMessage,
  ConnectionRecord,
  ConnectionStateChangedEvent,
  ConsoleLogger,
  CredentialEventTypes,
  CredentialRecord,
  CredentialState,
  CredentialStateChangedEvent,
  HttpOutboundTransport,
  InitConfig,
  LogLevel,
} from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/react-native'
```

### 2- Download genesis file (Optional)

####Mobile agent context:
When working with an Indy network, the ledger’s genesis file contains the information necessary for an agent to connect to that ledger. In other words, the genesis file contains the schema (like a DB schema) of the target Indy node ledger you are attempting to connect to.
You will need the genesis file of the Indy ledger you are connecting to, to issue, accept, prove, and verify credentials.
For example, lets say your agent will need to accept a verifiable credential from trinsic.id, you will probably need to download the genesis file for the Sovrin network.

- [Sovrin Mainnet](https://github.com/sovrin-foundation/sovrin/blob/master/sovrin/pool_transactions_live_genesis)
- [Sovrin Stagingnet](https://github.com/sovrin-foundation/sovrin/blob/master/sovrin/pool_transactions_sandbox_genesis)
- [Sovrin Buildernet](https://github.com/sovrin-foundation/sovrin/blob/master/sovrin/pool_transactions_builder_genesis)

More to find [here](https://github.com/sovrin-foundation/sovrin/tree/stable/sovrin)

Other

- [Indicio TestNet](https://raw.githubusercontent.com/Indicio-tech/indicio-network/main/genesis_files/pool_transactions_testnet_genesis)

#### Local network:

Example: [DTS Verifiable Credential Issuer Service](https://github.com/bcgov/dts-vc-issuer-service)
Corresponding genesis file: http://test.bcovrin.vonx.io/genesis

Sample initialization code

```ts
const BCOVRIN_TEST_GENESIS = `{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node1","blskey":"4N8aUNHSgjQVgkpm8nhNEfDf6txHznoYREg9kirmJrkivgL4oSEimFF6nsQ6M41QvhM2Z33nves5vfSn9n1UwNFJBYtWVnHYMATn76vLuL3zU88KyeAYcHfsih3He6UHcXDxcaecHVz6jhCYz1P2UZn2bDVruL5wXpehgBfBaLKm3Ba","blskey_pop":"RahHYiCvoNCtPTrVtP7nMC5eTYrsUA8WjXbdhNc8debh1agE9bGiJxWBXYNFbnJXoXhWFMvyqhqhRoq737YQemH5ik9oL7R4NTTCz2LEZhkgLJzB3QRQqJyBNyv7acbdHrAT8nQ9UkLbaVL9NBpnWXBTw4LEMePaSHEw66RzPNdAX1","client_ip":"138.197.138.255","client_port":9702,"node_ip":"138.197.138.255","node_port":9701,"services":["VALIDATOR"]},"dest":"Gw6pDLhcBcoQesN72qfotTgFa7cbuqZpkX3Xo6pLhPhv"},"metadata":{"from":"Th7MpTaRZVRYnPiabds81Y"},"type":"0"},"txnMetadata":{"seqNo":1,"txnId":"fea82e10e894419fe2bea7d96296a6d46f50f93f9eeda954ec461b2ed2950b62"},"ver":"1"}
{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node2","blskey":"37rAPpXVoxzKhz7d9gkUe52XuXryuLXoM6P6LbWDB7LSbG62Lsb33sfG7zqS8TK1MXwuCHj1FKNzVpsnafmqLG1vXN88rt38mNFs9TENzm4QHdBzsvCuoBnPH7rpYYDo9DZNJePaDvRvqJKByCabubJz3XXKbEeshzpz4Ma5QYpJqjk","blskey_pop":"Qr658mWZ2YC8JXGXwMDQTzuZCWF7NK9EwxphGmcBvCh6ybUuLxbG65nsX4JvD4SPNtkJ2w9ug1yLTj6fgmuDg41TgECXjLCij3RMsV8CwewBVgVN67wsA45DFWvqvLtu4rjNnE9JbdFTc1Z4WCPA3Xan44K1HoHAq9EVeaRYs8zoF5","client_ip":"138.197.138.255","client_port":9704,"node_ip":"138.197.138.255","node_port":9703,"services":["VALIDATOR"]},"dest":"8ECVSk179mjsjKRLWiQtssMLgp6EPhWXtaYyStWPSGAb"},"metadata":{"from":"EbP4aYNeTHL6q385GuVpRV"},"type":"0"},"txnMetadata":{"seqNo":2,"txnId":"1ac8aece2a18ced660fef8694b61aac3af08ba875ce3026a160acbc3a3af35fc"},"ver":"1"}
{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node3","blskey":"3WFpdbg7C5cnLYZwFZevJqhubkFALBfCBBok15GdrKMUhUjGsk3jV6QKj6MZgEubF7oqCafxNdkm7eswgA4sdKTRc82tLGzZBd6vNqU8dupzup6uYUf32KTHTPQbuUM8Yk4QFXjEf2Usu2TJcNkdgpyeUSX42u5LqdDDpNSWUK5deC5","blskey_pop":"QwDeb2CkNSx6r8QC8vGQK3GRv7Yndn84TGNijX8YXHPiagXajyfTjoR87rXUu4G4QLk2cF8NNyqWiYMus1623dELWwx57rLCFqGh7N4ZRbGDRP4fnVcaKg1BcUxQ866Ven4gw8y4N56S5HzxXNBZtLYmhGHvDtk6PFkFwCvxYrNYjh","client_ip":"138.197.138.255","client_port":9706,"node_ip":"138.197.138.255","node_port":9705,"services":["VALIDATOR"]},"dest":"DKVxG2fXXTU8yT5N7hGEbXB3dfdAnYv1JczDUHpmDxya"},"metadata":{"from":"4cU41vWW82ArfxJxHkzXPG"},"type":"0"},"txnMetadata":{"seqNo":3,"txnId":"7e9f355dffa78ed24668f0e0e369fd8c224076571c51e2ea8be5f26479edebe4"},"ver":"1"}
{"reqSignature":{},"txn":{"data":{"data":{"alias":"Node4","blskey":"2zN3bHM1m4rLz54MJHYSwvqzPchYp8jkHswveCLAEJVcX6Mm1wHQD1SkPYMzUDTZvWvhuE6VNAkK3KxVeEmsanSmvjVkReDeBEMxeDaayjcZjFGPydyey1qxBHmTvAnBKoPydvuTAqx5f7YNNRAdeLmUi99gERUU7TD8KfAa6MpQ9bw","blskey_pop":"RPLagxaR5xdimFzwmzYnz4ZhWtYQEj8iR5ZU53T2gitPCyCHQneUn2Huc4oeLd2B2HzkGnjAff4hWTJT6C7qHYB1Mv2wU5iHHGFWkhnTX9WsEAbunJCV2qcaXScKj4tTfvdDKfLiVuU2av6hbsMztirRze7LvYBkRHV3tGwyCptsrP","client_ip":"138.197.138.255","client_port":9708,"node_ip":"138.197.138.255","node_port":9707,"services":["VALIDATOR"]},"dest":"4PS3EDQ3dW1tci1Bp6543CfuuebjFrg36kLAUcskGfaA"},"metadata":{"from":"TWwCRQRZ2ZHMJFn9TzLp7W"},"type":"0"},"txnMetadata":{"seqNo":4,"txnId":"aa5e817d7cc626170eca175822029339a444eb0ee8f0bd20d3b0b76e566fb008"},"ver":"1"}`

const agentConfig = {
   poolName: 'BCovrin Test'
   genesisTransactions: BCOVRIN_TEST_GENESIS
}


```

Note: You do not need the genesis file if you are creating a connection between your Agent and another Agent for exchanging simple messages.

### 3- Get Mediator Connection URL (Optional)

Mediators (Routing Agents) are Agents that serve as intermediaries to facilitate the flow of messages between other types of agents.
You will need a mediator Agent if you are going to deal with VC (Verifiable Credentials), however, you can ignore the mediator step if you are creating an Agent for the sole purpose of exchanging messages with another Agent.

Example: If you are testing VC related functionality and need a mediator, you can use the [Animo Public Mediator](https://mediator.animo.id/invitation).

- Head to [Animo Public Mediator](https://mediator.animo.id/invitation).
- Copy mediator invite url and save it (i.e. MEDIATOR_INVITE = "url").

Other alternatives:

- [Indicio Public Mediator](https://indicio-tech.github.io/mediator/).

More about [Mediators](3-routing.md).

### 4- Create Agent

```ts
const agentConfig: InitConfig = {
  label: 'My Agent',
  mediatorConnectionsInvite: MEDIATOR_INVITE,
  walletConfig: {
    id: 'WalletId',
    key: 'TestKey',
  },
  autoAcceptConnections: true,
  autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
  autoAcceptProofs: AutoAcceptProof.ContentApproved,
  poolName: 'BCovrin Test',
  genesisTransactions: BCOVRIN_TEST_GENESIS,
  logger: new ConsoleLogger(LogLevel.debug),
}

const agent = new Agent(agentConfig, agentDependencies)
```

### 5- Create Transports

After creating the Agent object, we need to create and set the Inbound/Outbound transports that will handle traffic to/from the Agent.

```ts
const httpOutboundTransporter = new HttpOutboundTransporter()
agent.registerOutboundTransport(httpOutboundTransporter)

//Inbound transports are currently built-in, you don't need to create them.
```

More about [Transports](1-transports.md).

### 6- Init Agent

After creating the Agent object and configuring it, we initialize the Agent.

```ts
// It's highly recommended to wrap the initialization flow in a try/catch block
try {
  await agent.initialize()
  console.log('Initialized agent!')
} catch (e) {
  console.log(`Agent init error:${e}`)
}
```

### 7. Handling State Changes

After you successfully initialize your Agent, you will notice that most of the hard work is being done by the underlying Aries/Indy framework. However, you as a controller will need to intercept in some situations when there is a state change (like when you need to accept an offered credential or reject/accept an incoming connection request). This is done through state change handlers.

#### Creating Event(State) Handlers

```ts
agent.events.on<AgentMessageReceivedEvent>(AgentEventTypes.AgentMessageReceived, handleBasicMessageReceive)

agent.events.on<CredentialStateChangedEvent>(
  CredentialEventTypes.CredentialStateChanged,
  // Custom callback for handling any state change when offering/receiving VCs
  handleCredentialStateChange
)

agent.events.on<ConnectionStateChangedEvent>(
  ConnectionEventTypes.ConnectionStateChanged,
  // Custom callback for handling any state change when offering/receiving a connection
  handleConnectionStateChange(event)
)
```

Example: This sample credential callback shows how to detect that a credential is received, show the user the credential asserts and give the option to accept/reject the offered credential.

```ts
const handleCredentialStateChange = async (event: CredentialStateChangedEvent) => {
  console.log(
    `>> Credential state changed: ${event.payload.credentialRecord.id}, previous state -> ${event.payload.previousState} new state: ${event.payload.credentialRecord.state}`
  )

  if (event.payload.credentialRecord.state === CredentialState.OfferReceived) {
    console.log(`>> Received offer, should display credential to user`)

    // Display offer to user
    // On user click "Accept"
    console.log(`>>ACCEPTING OFFER`)
    agent.credentials.acceptOffer(event.payload.credentialRecord.id)
  } else if (event.payload.credentialRecord.state === CredentialState.Done) {
    Alert.alert('Credential Saved')
  }
}
```

More about [Credentials](5-credentials.md).
See [Overview](overview.md) for more information on how event handlers work.

Thats it, you are good to go with the Agent.

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
