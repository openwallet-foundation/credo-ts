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
## Complete Agent Initialization

This is the optimal initialization code for a scenario where complete functionality is needed.
We will walk through the following steps to initialize the agent with full capabilities.

### 1- Import statements
```ts
import {
  Agent,
  ConnectionEventTypes,
  ConnectionInvitationMessage,
  ConnectionRecord,
  ConnectionStateChangedEvent,
  ConsoleLogger,
  CredentialEventTypes,
  CredentialRecord,
  CredentialStateChangedEvent,
  HttpOutboundTransporter,
  InitConfig,
  LogLevel,
} from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'
import RNFS from 'react-native-fs'
```

### 2- Download genesis file (Optional)

When working with an Indy network, the ledger’s genesis file contains the information necessary for an agent to connect to that ledger.  In other words, the genesis file contains the schema (like a DB schema) of the target Indy node ledger you are attempting to connect to. 
You will need the genesis file of the Indy ledger you are connecting to, to issue, accept, prove, and verify credentials.
For example, lets say your agent will need to accept a verifiable credential from trinsic.id, you will probably need to download the genesis file for the Sovrin network.


- [Sovrin Mainnet](https://github.com/sovrin-foundation/sovrin/blob/master/sovrin/pool_transactions_live_genesis)
- [Sovrin Stagingnet](https://github.com/sovrin-foundation/sovrin/blob/master/sovrin/pool_transactions_sandbox_genesis)
- [Sovrin Buildernet](https://github.com/sovrin-foundation/sovrin/blob/master/sovrin/pool_transactions_builder_genesis)

More to find [here](https://github.com/sovrin-foundation/sovrin/tree/stable/sovrin)


Other 
- [Indicio TestNet](https://raw.githubusercontent.com/Indicio-tech/indicio-network/main/genesis_files/pool_transactions_testnet_genesis)

#### Local network: 

If you are going to test with a local network you have to download the genesis file corresponding to the networks local ledger.
Example: [DTS Verifiable Credential Issuer Service](https://github.com/bcgov/dts-vc-issuer-service)
Corresponding genesis file: http://test.bcovrin.vonx.io/genesis

Code for downloading genesis file

```ts
//Function for downloading genesis file and return string value
async function downloadGenesis(genesisUrl: string) {
  try {
    const response = await axios.get(genesisUrl); //Axios is a lightweight HTTP client, you can use any other library
    return response.data;
  } catch (e) {
    console.log('EXCEPTION> downloadGenesis:', e);
    return null;
  }
}


//Function for storing genesis string value to a local file on the device 
async function storeGenesis(
  genesis: string,
  fileName: string,
): Promise<string> {
  try {
    const genesisPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
    await RNFS.writeFile(genesisPath, genesis, 'utf8');
    return genesisPath;
  } catch (e) {
    console.log('EXCEPTION> storeGenesis:', e);
    return '';
  }
}

//Somewhere in the code (before init Agent)
const genesis = await downloadGenesis(GENESIS_URL);
const genesisPath = await storeGenesis(genesisString, 'genesis.txn');

```

Note: You do not need the genesis file if you are creating a connection between your Agent and another Agent for exchanging simple messages.

### 3- Get Mediator Connection URL (Optional)

Mediators (Routing Agents) are Agents that serve as intermediaries to facilitate the flow of messages between other types of agents.
You will need a mediator Agent if you are going to deal with VC (Verifiable Credentials), however, you can ignore the mediator step if you are creating an Agent for the sole purpose of exchanging messages with another Agent. 

Example: If you are testing VC related functionality and need a mediator, you can use the [Indicio Public Mediator](https://indicio-tech.github.io/mediator/).
- Head to [Indicio Public Mediator](https://indicio-tech.github.io/mediator/).
- Copy mediator invite url and save it (i.e. MEDIATOR_INVITE = "url").

Note: If the invite url uses insecure http you will have to adjust your code to allow for insecure traffic.
- Instructions for [iOS](https://stackoverflow.com/questions/31254725/transport-security-has-blocked-a-cleartext-http).
- Instructions for [Android](https://stackoverflow.com/questions/51902629/how-to-allow-all-network-connection-types-http-and-https-in-android-9-pie).

More about [Mediators](3-routing.md).

### 4- Create Agent

```ts
const agentConfig: InitConfig = {
      label: 'my-agent9',
      mediatorConnectionsInvite: MEDIATOR_INVITE,
      walletConfig: {id: 'walletId10'},
      walletCredentials: {key: 'testkey0230482304823042304244'},
      autoAcceptConnections: true,
      autoAcceptCredentials: AutoAcceptCredential.ContentApproved,
      autoAcceptProofs: AutoAcceptProof.ContentApproved,
      poolName: 'test-193',
      genesisPath,
      logger: new ConsoleLogger(LogLevel.debug),
    };

    const agent = new Agent(agentConfig, agentDependencies);

```

### 5- Create Transports

After creating the Agent object, we need to create and set the Inbound/Outbound transports that will handle traffic to/from the Agent.


```ts
  const httpOutboundTransporter = new HttpOutboundTransporter();
  agent.setOutboundTransporter(httpOutboundTransporter);

  //Inbound transports are currently built-in, you don't need to create them.
```

More about [Transports](1-transports.md).


### 6- Init Agent

After creating the Agent object and configuring it, we initialize the Agent.

```ts

//Its highly recommended to wrap the initialization flow in a try/catch block 
try
{
  await agent.initialize();
  console.log('Initialized agent!');
}catch(e){
  console.log(`Agent init error:${e}`);
}
```


### 6- Handling State Changes

After you successfully initialize your Agent, you will notice that most of the hard work is being done by the underlying Aries/Indy framework. However, you as a controller will need to intercept in some situations when there is a state change (like when you need to accept an offered credential or reject/accept an incoming connection request). This is done through state change handlers.

#### Creating Event(State) Handlers 

```ts

agent.events.on(
      AgentEventTypes.AgentMessageReceived,
      handleBasicMessageReceive,
);

agent.events.on<CredentialStateChangedEvent>(
  CredentialEventTypes.CredentialStateChanged,
  event => {
    handleCredentialStateChange(event); //custom callback for handling any state change when offering/receiving VCs
  },
);

agent.events.on<ConnectionStateChangedEvent>(
  ConnectionEventTypes.ConnectionStateChanged,
  event => {
    handleConnectionStateChange(event); //custom callback for handling any state change when offering/receiving a connection
  },
);
```

Example: This sample credential callback shows how to detect that a credential is received, show the user the credential asserts and give the option to accept/reject the offered credential.

```ts
const handleCredentialStateChange = async (
  event: CredentialStateChangedEvent,
) => {
  console.log(
    `>> Credential state changed: ${event.payload.credentialRecord.id}, previous state -> ${event.payload.previousState} new state: ${event.payload.credentialRecord.state}`,
  );

  if (event.payload.credentialRecord.state === 'offer-received') {
    console.log(`>> Received offer, should display credential to user`);
    
    // Display offer to user 
    // On user click "Accept"
    console.log(`>>ACCEPTING OFFER`);
    agent.credentials.acceptOffer(event.payload.credentialRecord.id);

  } else if (event.payload.credentialRecord.state === 'credential-received') {

    //Credential recieved and stored in the wallet
    console.log('>> Received Credential');
    await agent.credentials.acceptCredential(event.payload.credentialRecord.id);
    console.log('ALL DONE - CREDENTAIL ACCEPTED');
  }
};
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
