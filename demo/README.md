<h1 align="center"><b>DEMO</b></h1>

This is the Aries Framework Javascript demo. Walk through the AFJ flow yourself together with agents Alice and Faber

## Features

- ✅ Creating a connection
- ✅ Offering a credential
- ✅ Requesting a proof
- ✅ Sending basic messages

## Getting Started

### Platform Specific Setup

In order to use Aries Framework JavaScript some platform specific dependencies and setup is required. See our guides below to quickly set up you project with Aries Framework JavaScript for NodeJS, React Native and Electron.

- [React Native](/docs/setup-react-native.md)
- [NodeJS](/docs/setup-nodejs.md)
- [Electron](/docs/setup-electron.md)

### Run the demo

These are the steps for running the AFJ demo:

Clone the AFJ git repository
```sh
git clone https://github.com/hyperledger/aries-framework-javascript.git
```

Go to the demo folder
```sh
cd demo
```

Install the project
```sh
yarn install
```

Open two different terminals next to each other and run each agent seperatly
```sh
yarn alice
```

```sh
yarn faber
```

### Usage

To set up a connection:
- select 'setup connection' in both Agents
- Alice will print a invitation link which you then copy and paste to Faber
- You have now set up a connection!

To offer a credential:
- select 'offer credential' in Faber
- Faber will start with registering a schema and the credential definition accordingly
- You have now send a credential offer to Alice!
- Go to Alice to accept the incoming credential offer

To request a proof:
- select 'request proof' in Faber
- Faber will create a new proof attribute and will then send a proof request to Alice!
- Go to Alice to accept the incoming proof request

To send a basic message:
- select 'send message' in either one of the Agents
- Type your message and press Enter
- Message send!

Exit the demo by selecting 'Exit', this will shutdown the agent and 'Restart' will do so too but will setup a new agent inmediatly.