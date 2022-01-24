<h1 align="center"><b>DEMO</b></h1>

This is the Aries Framework Javascript demo. Walk through the AFJ flow yourself together with agents Alice and Faber.

## Features

- ✅ Creating a connection
- ✅ Offering a credential
- ✅ Requesting a proof
- ✅ Sending basic messages

## Getting Started

### Platform Specific Setup

In order to use Aries Framework JavaScript some platform specific dependencies and setup is required. See our guides below to quickly set up you project with Aries Framework JavaScript for NodeJS, React Native and Electron.

- [NodeJS](/docs/setup-nodejs.md)

### Run the demo

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

In the left terminal run Alice:

```sh
yarn alice
```

In the right terminal run Faber:

```sh
yarn faber
```

### Usage

To set up a connection:

- Select 'setup connection' in both Agents
- Alice will print a invitation link which you then copy and paste to Faber
- You have now set up a connection!

To offer a credential:

- Select 'offer credential' in Faber
- Faber will start with registering a schema and the credential definition accordingly
- You have now send a credential offer to Alice!
- Go to Alice to accept the incoming credential offer

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
