# Framework Developers

This file is intended for developers working on the internals of the framework. If you're just looking how to get started with the framework, see the [docs](./docs)

## Running tests

Test are executed using jest. Some test require either the **mediator agents** or the **ledger** to be running. When running tests that require a connection to the ledger pool, you need to set the `TEST_AGENT_PUBLIC_DID_SEED` and `GENESIS_TXN_PATH` environment variables.

### Setting environment variables

If you're using the setup as described in this document, you don't need to provide any environment variables as the default will be sufficient.

- `GENESIS_TXN_PATH`: The path to the genesis transaction that allows us to connect to the indy pool.
  - `GENESIS_TXN_PATH=network/genesis/local-genesis.txn` - default. Works with the [ledger setup](#setup-ledger) from the previous step.
  - `GENESIS_TXN_PATH=network/genesis/builder-net-genesis.txn` - Sovrin BuilderNet genesis.
  - `GENESIS_TXN_PATH=/path/to/any/ledger/you/like`
- `TEST_AGENT_PUBLIC_DID_SEED`: The seed to use for the public DID. This will be used to do public write operations to the ledger. You should use a seed for a DID that is already registered on the ledger.
  - If using the local or default genesis, use the same seed you used for the `add-did-from-seed` command from the [ledger setup](#setup-ledger) in the previous step.
  - If using the BuilderNet genesis, make sure your seed is registered on the BuilderNet using [selfserve.sovrin.org](https://selfserve.sovrin.org/) and you have read and accepted the associated [Transaction Author Agreement](https://github.com/sovrin-foundation/sovrin/blob/master/TAA/TAA.md). We are not responsible for any unwanted consequences of using the BuilderNet.

### Starting mediator agents

To start the mediator agents you need to run four commands. See the [Usage with Docker](#usage-with-docker) section on how to run the mediators inside docker.

Open four terminals and start the mediators:

```sh
./scripts/run-mediator.sh mediator01
```

```sh
./scripts/run-mediator.sh mediator02
```

```sh
./scripts/run-mediator.sh mediator03
```

```sh
./scripts/run-mediator.sh mediator04
```

### Setup Ledger

For testing we've added a setup to this repo that allows you to quickly setup an indy ledger.

```sh
# Build indy pool
docker build -f network/indy-pool.dockerfile -t indy-pool . --platform linux/amd64

# Start indy pool
docker run -d --rm --name indy-pool -p 9701-9708:9701-9708 indy-pool

# Setup CLI. This creates a wallet, connects to the ledger and sets the Transaction Author Agreement
docker exec indy-pool indy-cli-setup

#  DID and Verkey from seed. Set 'Trustee' role in order to be able to register public DIDs
docker exec indy-pool add-did-from-seed 000000000000000000000000Trustee9 TRUSTEE

# If you want to register using the DID/Verkey you can use
# docker exec indy-pool add-did "NkGXDEPgpFGjQKMYmz6SyF" "CrSA1WbYYWLJoHm16Xw1VEeWxFvXtWjtsfEzMsjB5vDT"
```

#### With Docker

To run the mediators inside docker you can use the `docker-compose-mediators.yml` file:

```sh
# Run alice-mediator, bob-mediator, alice-ws-mediator and bob-ws-mediator
docker-compose -f docker/docker-compose-mediators.yml up -d
```

If you want the ports to be exposed to the outside world using ngrok you can use the `docker-compose-mediators-ngrok.yml` extension. Make sure the ngrok docker compose file is used after the normal docker compose file.

```sh
# Run alice-mediator and bob-mediator exposed via ngrok
docker-compose -f docker/docker-compose-mediators.yml -f docker/docker-compose-mediators-ngrok.yml up -d
```

### Only run e2e tests with in memory messaging

You don't have to start mediator agents or the ledger for these tests. Communication is done via RxJS subscriptions.

```
yarn test -t "agents"
```

### Only run e2e tests with HTTP based routing agencies

Make sure the **mediator agents** from the [Starting mediator agents](#starting-mediator-agents) step are running and then run:

```
yarn test -t "with mediator"
```

### Run all tests

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
docker run --rm --network host --env TEST_AGENT_PUBLIC_DID_SEED=000000000000000000000000Trustee9 --env GENESIS_TXN_PATH=network/genesis/local-genesis.txn aries-framework-javascript yarn test
```
