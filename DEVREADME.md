# Framework Developers

This file is intended for developers working on the internals of the framework. If you're just looking how to get started with the framework, see the [docs](./docs)

# Environment Setup

## DID resolver caching

Resolvers declare `allowsCaching` on the
[DidResolver interface](./packages/core/src/modules/dids/domain/DidResolver.ts). Cache-enabled resolvers
use global scope by default, sharing resolution results across agent contexts using the same cache.
Core does not maintain a list of public DID methods, and resolvers do not declare cache scope.

Configure sparse per-method overrides through the agent's DID module options:

```ts
modules: {
  dids: {
    cacheScope: {
      web: 'context',
      cheqd: 'global',
    },
  },
}
```

Unspecified methods still use global scope; an empty map does not force context scope. Set a method
to `context` whenever its resolution depends on tenant-specific storage, credentials, or policy.
Scope configuration does not enable caching for resolvers with `allowsCaching: false`.

This replaces `publicDidMethods`. To migrate a previous explicit list, configure `context` for each
cache-enabled method that was excluded from that list. Custom cache-enabled methods now default to
global scope too, so review their tenant-isolation requirements.

The same scope applies to cache reads, writes, and invalidation after DID updates or deactivation.
Existing TTL and per-call cache controls remain unchanged. Key, JWK, and Peer resolvers do not cache.

## VSCode devContainer

This project comes with a [.devcontainer](./devcontainer) to make it as easy as possible to setup your dev environment and begin contributing to this project.

[Environment variables](https://code.visualstudio.com/remote/advancedcontainers/environment-variables) can be added to [devcontainer.env](./devcontainer.env) and exposed to the development docker container.

When running in a container your project root directory will be `/work`. Use this to correctly path any environment variables.

## Running tests

Test are executed using vitest. E2E tests (ending in `.e2e.test.ts`) require the **postgres database** or **redis** to be running. Drizzle tests (ending in `drizzle.e2e.test.ts`) require the **postgres database** to be running.

NOTE: when running the Drizzle tests, you must first run `pnpm build`, as the CLI requires the built packages.

### Quick Setup

To quickly set up all services needed to run tests (Postgres and Redis), run the following command:

```sh
docker compose up -d
```

### Run all tests

You can run all unit tests (which **do not** require the docker services to be running) using the following command.

```sh
pnpm test:unit
```

To run the e2e tests:

```sh
pnpm test:e2e
```

You can also run **all** tests:

```sh
pnpm test
```

Ledger integrations such as Indy VDR, Hedera and cheqd, and their test ledgers, are maintained in [credo-ts-ext](https://github.com/openwallet-foundation/credo-ts-ext).
