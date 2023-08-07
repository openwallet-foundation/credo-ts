# Framework Developers

This file is intended for developers working on the internals of the framework. If you're just looking how to get started with the framework, see the [docs](./docs)

# Environment Setup

## VSCode devContainer

This project comes with a [.devcontainer](./devcontainer) to make it as easy as possible to setup your dev environment and begin contributing to this project.

All the [environment variables](https://code.visualstudio.com/remote/advancedcontainers/environment-variables) noted below can be added to [devcontainer.env](./devcontainer.env) and exposed to the development docker container.

When running in a container your project root directory will be `/work`. Use this to correctly path any environment variables, for example:

```console
GENESIS_TXN_PATH=/work/network/genesis/local-genesis.txn
```

## Running tests

Test are executed using jest. Some test require either the **mediator agents** or the **ledger** to be running. When running tests that require a connection to the ledger pool, you need to set the `TEST_AGENT_PUBLIC_DID_SEED`, `ENDORSER_AGENT_PUBLIC_DID_SEED` and `GENESIS_TXN_PATH` environment variables.

### Setting environment variables

If you're using the setup as described in this document, you don't need to provide any environment variables as the default will be sufficient.

- `GENESIS_TXN_PATH`: The path to the genesis transaction that allows us to connect to the indy pool.
  - `GENESIS_TXN_PATH=network/genesis/local-genesis.txn` - default. Works with the [ledger setup](#setup-indy-ledger) from the previous step.
  - `GENESIS_TXN_PATH=network/genesis/builder-net-genesis.txn` - Sovrin BuilderNet genesis.
  - `GENESIS_TXN_PATH=/path/to/any/ledger/you/like`
- `TEST_AGENT_PUBLIC_DID_SEED`: The seed to use for the public DID. This will be used to do public write operations to the ledger. You should use a seed for a DID that is already registered on the ledger.
  - If using the local or default genesis, use the same seed you used for the `add-did-from-seed` command from the [ledger setup](#setup-indy-ledger) in the previous step. (default is `000000000000000000000000Trustee9`)
  - If using the BuilderNet genesis, make sure your seed is registered on the BuilderNet using [selfserve.sovrin.org](https://selfserve.sovrin.org/) and you have read and accepted the associated [Transaction Author Agreement](https://github.com/sovrin-foundation/sovrin/blob/master/TAA/TAA.md). We are not responsible for any unwanted consequences of using the BuilderNet.
- `ENDORSER_AGENT_PUBLIC_DID_SEED`: The seed to use for the public Endorser DID. This will be used to endorse transactions. You should use a seed for a DID that is already registered on the ledger.
  - If using the local or default genesis, use the same seed you used for the `add-did-from-seed` command from the [ledger setup](#setup-indy-ledger) in the previous step. (default is `00000000000000000000000Endorser9`)
  - If using the BuilderNet genesis, make sure your seed is registered on the BuilderNet using [selfserve.sovrin.org](https://selfserve.sovrin.org/) and you have read and accepted the associated [Transaction Author Agreement](https://github.com/sovrin-foundation/sovrin/blob/master/TAA/TAA.md). We are not responsible for any unwanted consequences of using the BuilderNet.

### Setup Postgres

> Note: Setup the postgres plugin first by following the [docs](https://aries.js.org/)

```sh
# Get postgres docker image
docker pull postgres

# Run postgres in docker
docker run --name postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres
```

### Setup Indy Ledger

For testing we've added a setup to this repo that allows you to quickly setup an indy ledger.

```sh
# Build indy pool
docker build -f network/indy-pool.dockerfile -t indy-pool . --platform linux/amd64

# NOTE: If you are on an ARM (M1) mac use the `network/indy-pool-arm.dockerfile` instead
# docker build -f network/indy-pool-arm.dockerfile -t indy-pool . --platform linux/arm64/v8

# Start indy pool
docker run -d --rm --name indy-pool -p 9701-9708:9701-9708 indy-pool

# Setup CLI. This creates a wallet, connects to the ledger and sets the Transaction Author Agreement
docker exec indy-pool indy-cli-setup

#  DID and Verkey from seed. Set 'ENDORSER' role in order to be able to register public DIDs
docker exec indy-pool add-did-from-seed 00000000000000000000000Endorser9 ENDORSER

#  DID and Verkey from seed. Set 'Trustee'
docker exec indy-pool add-did-from-seed 000000000000000000000000Trustee9 TRUSTEE

# If you want to register using the DID/Verkey you can use
# docker exec indy-pool add-did "NkGXDEPgpFGjQKMYmz6SyF" "CrSA1WbYYWLJoHm16Xw1VEeWxFvXtWjtsfEzMsjB5vDT"
```

### Setup Cheqd Ledger

In addition, there's also a docker command to run a cheqd test network.

```sh
docker run --rm -d -p 26657:26657 ghcr.io/cheqd/cheqd-testnet:latest
```

If you want to run tests without the cheqd ledger, you can use the following ignore pattern:

```sh
yarn test --testPathIgnorePatterns packages/cheqd
```

### Run all tests

You can run the tests using the following command.

```sh
yarn test
```

If you're not using the ledger setup from above, make sure you pass the correct environment variables from [Setting environment variables](#setting-environment-variables) for connecting to the indy **ledger** pool.

```sh
GENESIS_TXN_PATH=network/genesis/local-genesis.txn TEST_AGENT_PUBLIC_DID_SEED=000000000000000000000000Trustee9 ENDORSER_AGENT_PUBLIC_DID_SEED=00000000000000000000000Endorser9 yarn test
```

Locally, you might want to run the tests without postgres tests. You can do that by ignoring the tests:

```sh
yarn test --testPathIgnorePatterns postgres.e2e.test.ts
```

In case you run into trouble running the tests, e.g. complaining about snapshots not being up-to-date, you can try and remove the data stored for the indy-client or AFJ. Note this removes all wallets and data, so make sure you're okay with all data being removed. On a Unix system with default setup you achieve this by running:

```sh
rm -rf ~/.indy-client ~/.afj
```

## Usage with Docker

If you don't want to install the libindy dependencies yourself, or want a clean environment when running the framework or tests you can use docker.

Make sure you followed the [local ledger setup](#setup-indy-ledger) to setup a local indy pool inside docker.

```sh
# Builds the framework docker image with all dependencies installed
docker build -t aries-framework-javascript .

# Run test with ledger pool
docker run -it --rm --network host aries-framework-javascript yarn test
```
