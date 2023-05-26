<h1 align="center"><b>DEMO</b></h1>

This is the Aries Framework Javascript demos. Walk through the available AFJ flows yourself together with agents Alice and Faber.

## Flows

- `Main` - General flow: Alice, a former student of Faber College, connects with the College, is issued a credential about her degree and then is asked by the College for a proof.  
  - ✅ Creating a connection
  - ✅ Offering a credential
  - ✅ Requesting a proof
  - ✅ Sending basic messages
- `DidComm V2` - [DidComm v2 massaging](https://identity.foundation/didcomm-messaging/spec/) usage. In contrast to the `Main` this demo provides functionality limited to sending `ping` message after accepting out-of-band invitation from the invitee.        
  - ✅ Creating a connection
  - ✅ Ping
    > Integration of DidComm V2 protocols is currently under development! In the future, it will cover the same features as the `Main` flow. 

## Getting Started

### Platform Specific Setup

In order to use Aries Framework JavaScript some platform specific dependencies and setup is required. See our guides below to quickly set up you project with Aries Framework JavaScript for NodeJS, React Native and Electron.

- [NodeJS](https://aries.js.org/guides/getting-started/installation/nodejs)

### Preparation

These are the steps for running the AFJ demo:

Clone the AFJ git repository:

```sh
git clone https://github.com/hyperledger/aries-framework-javascript.git
```

Open two different terminals next to each other and in both, go to the demo folder:

```sh
cd aries-framework-javascript/demo
```

Install the project in one of the terminals:

```sh
yarn install
```

### Run the demo

#### Main demo

In the left terminal run Alice:

```sh
yarn alice
```

In the right terminal run Faber:

```sh
yarn faber
```

##### Usage

To set up a connection:

- Select 'receive connection invitation' in Alice and 'create connection invitation' in Faber
- Faber will print a invitation link which you then copy and paste to Alice
- You have now set up a connection!

To offer a credential:

- Select 'offer credential' in Faber
- Faber will start with registering a schema and the credential definition accordingly
- You have now send a credential offer to Alice!
- Go to Alice to accept the incoming credential offer by selecting 'yes'.

To request a proof:

- Select 'request proof' in Faber
- Faber will create a new proof attribute and will then send a proof request to Alice!
- Go to Alice to accept the incoming proof request

To send a basic message:

- Select 'send message' in either one of the Agents
- Type your message and press enter
- Message sent!

Exit:

- Select 'exit' to shutdown the agent.

Restart:

- Select 'restart', to shutdown the current agent and start a new one

#### DidComm V2 demo

In the left terminal run Alice:

```sh
yarn alice-didcommv2
```

In the right terminal run Faber:

```sh
yarn faber-didcommv2
```

##### Usage

To set up a connection:

- Select 'receive connection invitation' in Alice and 'create connection invitation' in Faber
- Faber will print a invitation link which you then copy and paste to Alice
- You have now set up a connection!

To send a ping message:

- Establish the connection first
- Select 'ping' in the Alice Agent
- Message sent!
- Faber Agent should print notification about received `ping` message and response with `ping response` message back to Alice.

Exit:

- Select 'exit' to shutdown the agent.

Restart:

- Select 'restart', to shutdown the current agent and start a new one
