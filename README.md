<p align="center">
  <img alt="Hyperledger Aries logo" src="images/aries-logo.png" width="100px" />
  <h1 align="center">Aries Framework JavaScript</h1>
  <p align="center"><font size="+1">Built using TypeScript</font></p>
  <p align="center">
    <img alt="Pipeline Status" src="https://github.com/hyperledger/aries-framework-javascript/workflows/Continuous%20Integration/badge.svg?branch=master">
    <a href="https://lgtm.com/projects/g/hyperledger/aries-framework-javascript/context:javascript"><img alt="Language grade: JavaScript" src="https://img.shields.io/lgtm/grade/javascript/g/hyperledger/aries-framework-javascript.svg?logo=lgtm&logoWidth=18"/></a>
    <a href="https://raw.githubusercontent.com/hyperledger/aries-framework-go/master/LICENSE"><img alt="License" src="https://img.shields.io/badge/License-Apache%202.0-blue.svg"/></a>
    <a href="https://npmjs.com/package/aries-framework-javascript"><img alt="aries-framework-javascript npm version" src="https://img.shields.io/npm/v/aries-framework-javascript"></a>
</p>
</p>

Aries Framework JavaScript is a framework for building SSI Agents and DIDComm services that aims to be compliant and interoperable with the standards defined in the [Aries RFCs](https://github.com/hyperledger/aries-rfcs).

## Table of Contents <!-- omit in toc -->

- [Goals](#goals)
- [Usage](#usage)
  - [Prerequisites](#prerequisites)
  - [Installing](#installing)
  - [Using the framework](#using-the-framework)
  - [Logs](#logs)
- [Architecture](#architecture)
- [Development](#development)
  - [Setup Ledger](#setup-ledger)
  - [Running tests](#running-tests)
- [Usage with Docker](#usage-with-docker)
- [Contributing](#contributing)
- [License](#license)

## Goals

The framework is still in early development. At the moment the goal of this implementation is to run two independent Edge Agents (clients), running on mobile or desktop, which are able to communicate via a Mediator agent. It should at least adhere to the following requirements:

- Edge Agent is independent on underlying communication layer. It can communicate via either HTTP request-response, WebSockets or Push Notifications.
- Edge Agent can go offline and still receive its messages when it goes back to online.
- There should be an option to connect more clients (Edge Agents) to one Routing Agent.
- Prevent correlation.

See the [Roadmap](https://github.com/hyperledger/aries-framework-javascript/issues/39) or the [Framework Development](https://github.com/hyperledger/aries-framework-javascript/projects/1) project board for current progress.

## Usage

### Prerequisites

Aries Framework JavaScript depends on the indy-sdk which has some manual installation requirements. Before installing dependencies make sure to [install](https://github.com/hyperledger/indy-sdk/#installing-the-sdk) `libindy` and have the right tools installed for the [NodeJS wrapper](https://github.com/hyperledger/indy-sdk/tree/master/wrappers/nodejs#installing). The NodeJS wrapper link also contains some common troubleshooting steps. The [Dockerfile](./Dockerfile) contains everything needed to get started with the framework. See [Usage with Docker](#usage-with-docker) for more information.

> If you're having trouble running this project, please the the [troubleshooting](./TROUBLESHOOTING.md) section. It contains the most common errors that arise when first installing libindy.

### Installing

> NOTE: The package is not tested in multiple versions of Node at the moment. If you're having trouble installing dependencies or running the framework know that at least **Node v12 DOES WORK** and **Node v14 DOES NOT WORk**.

Currently the framework is working towards the first release of the package, until then the framework won't be available on NPM. However you can use the framework by packaging and adding it as a file to your project.

```sh
# Clone the repo
git clone https://github.com/hyperledger/aries-framework-javascript.git
cd aries-framework-javascript

# Install dependencies
yarn install

# Pack the framework
yarn pack
```

In a project, where you want to use this library as dependency, run:

```
yarn add file:PATH_TO_REPOSITORY_FOLDER/aries-framework-javascript/aries-framework-javascript-v1.0.0.tgz
```

### Using the framework

While the framework is still in early development the best way to know what API the framework exposes is by looking at the [tests](src/lib/__tests__), the [source code](src/lib) or the [samples](./src/samples). As the framework reaches a more mature state, documentation on the usage of the framework will be added.

### Logs

If you want the framework to show the logs while running, you can set the `DEBUG=aries-framework-javascript` debug environment variable. For running the sample mediator this means running `yarn prod:debug` instead of `yarn prod:start`

## Architecture

Agent class has method `receiveMessage` which **unpacks** incoming **inbound message** and then pass it to the `dispatch` method. This method just tries to find particular `handler` according to message `@type` attribute. Handler then process the message, calls services if needed and also creates **outbound message** to be send by sender, if it's required by protocol.

If handler returns an outbound message then method `sendMessage` **packs** the message with defined recipient and routing keys. This method also creates **forwardMessage** when routing keys are available. The way an outbound message is send depends on the implementation of MessageSender interface. Outbound message just need to contain all information which is needed for given communication (e. g. HTTP endpoint for HTTP protocol).

## Development

### Setup Ledger

```sh
# Build indy pool
docker build -f network/indy-pool.dockerfile -t indy-pool .

# Start indy pool
docker run -d --rm --name indy-pool -p 9701-9708:9701-9708 indy-pool

# Setup CLI. This creates a wallet, connects to the ledger and sets the Transaction Author Agreement
docker exec indy-pool indy-cli-setup

#  DID and Verkey from seed
docker exec indy-pool add-did-from-seed 000000000000000000000000Trustee9

# If you want to register using the DID/Verkey you can use
# docker exec indy-pool add-did "NkGXDEPgpFGjQKMYmz6SyF" "CrSA1WbYYWLJoHm16Xw1VEeWxFvXtWjtsfEzMsjB5vDT"
```

### Running tests

Test are executed using jest. Some test require either the **mediator agents** or the **ledger** to be running. When running tests that require a connection to the ledger pool, you need to set the `TEST_AGENT_PUBLIC_DID_SEED` and `GENESIS_TXN_PATH` environment variables.

#### Setting environment variables

- `GENESIS_TXN_PATH`: The path to the genesis transaction that allows us to connect to the indy pool.
  - `GENESIS_TXN_PATH=network/genesis/local-genesis.txn` - default. Works with the [ledger setup](#setup-ledger) from the previous step.
  - `GENESIS_TXN_PATH=network/genesis/builder-net-genesis.txn` - Sovrin BuilderNet genesis.
  - `GENESIS_TXN_PATH=/path/to/any/ledger/you/like`
- `TEST_AGENT_PUBLIC_DID_SEED`: The seed to use for the public DID. This will be used to do public write operations to the ledger. You should use a seed for a DID that is already registered on the ledger.
  - If using the local or default genesis, use the same seed you used for the `add-did-from-seed` command form the [ledger setup](#setup-ledger) in the previous step.
  - If using the BuilderNet genesis, make sure your seed is registered on the BuilderNet using [selfserve.sovrin.org](https://selfserve.sovrin.org/) and you have read and accepted the associated [Transaction Author Agreement](https://github.com/sovrin-foundation/sovrin/blob/master/TAA/TAA.md). We are not responsible for any unwanted consequences of using the BuilderNet.

#### Starting mediator agents

To start the mediator agents you need to run two commands. See the [Usage with Docker](#usage-with-docker) section on how to run the mediators inside docker.

Open terminal and start Alice's mediator:

```
./scripts/run-mediator.sh mediator01
```

Open new terminal and start Bob's mediator:

```
./scripts/run-mediator.sh mediator02
```

##### With Docker

To run the mediators inside docker you can use the `docker-compose-mediators.yml` file:

```sh
# Run alice-mediator and bob-mediator
docker-compose -f docker/docker-compose-mediators.yml up -d
```

If you want the ports to be exposed to the outside world using ngrok you can use the `docker-compose-mediators-ngrok.yml` extension. Make sure the ngrok docker compose file is used after the normal docker compose file.

```sh
# Run alice-mediator and bob-mediator exposed via ngrok
docker-compose -f docker/docker-compose-mediators.yml -f docker/docker-compose-mediators-ngrok.yml up -d
```

#### Only run e2e tests with in memory messaging

You don't have to start mediator agents or the ledger for these tests. Communication is done via RxJS subscriptions.

```
yarn test -t "agents"
```

#### Only run e2e tests with HTTP based routing agencies

Make sure the **mediator agents** from the [Starting mediator agents](#starting-mediator-agents) step are running and then run:

```
yarn test -t "with mediator"
```

#### Run all tests

Make sure the **mediator agents** from [Starting mediator agents](#starting-mediator-agents) are running and you pass the correct environment variables from [Setting environment variables](#setting-environment-variables) for connecting to the indy **ledger** pool.

```
GENESIS_TXN_PATH=network/genesis/local-genesis.txn TEST_AGENT_PUBLIC_DID_SEED=000000000000000000000000Trustee9 yarn test
```

## Usage with Docker

If you don't want to install the libindy dependencies yourself, or want a clean environment when running the framework or tests you can use docker.

Make sure you followed the [local ledger setup](#setup-ledger) to setup a local indy pool inside docker.

```sh
# Builds the framework docker image with all dependencies installed
docker build -t aries-framework-javascript .

# Run tests without network
docker run -it --rm aries-framework-javascript  yarn test -t "agents"

# Run test with mediator agents and ledger pool
docker-compose -f docker/docker-compose-mediators.yml up -d # Run alice-mediator and bob-mediator
docker run --rm --network host --env TEST_AGENT_PUBLIC_DID_SEED=000000000000000000000000Trustee9 --env GENESIS_TXN_PATH=network/genesis/local-genesis.txn --env DEBUG=aries-framework-javascript aries-framework-javascript yarn test
```

## Contributing

Found a bug? Ready to submit a PR? Want to submit a proposal for your grand idea? See our [CONTRIBUTING](CONTRIBUTING.md) file for more information to get you started!

## License

Hyperledger Aries Framework JavaScript is licensed under the [Apache License Version 2.0 (Apache-2.0)](LICENSE).
