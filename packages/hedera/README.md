<p align="center">
  <br />
  <img
    alt="Credo Logo"
    src="https://github.com/openwallet-foundation/credo-ts/blob/c7886cb8377ceb8ee4efe8d264211e561a75072d/images/credo-logo.png"
    height="250px"
  />
</p>
<h1 align="center"><b>Credo Hedera Module</b></h1>
<p align="center">
  <a
    href="https://raw.githubusercontent.com/openwallet-foundation/credo-ts/main/LICENSE"
    ><img
      alt="License"
      src="https://img.shields.io/badge/License-Apache%202.0-blue.svg"
  /></a>
  <a href="https://www.typescriptlang.org/"
    ><img
      alt="typescript"
      src="https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg"
  /></a>
    <a href="https://www.npmjs.com/package/@credo-ts/hedera"
    ><img
      alt="@credo-ts/hedera version"
      src="https://img.shields.io/npm/v/@credo-ts/hedera"
  /></a>

</p>
<br />

Credo hedera provides integration of the Hedera network into Credo. See the [Hedera Setup](https://credo.js.org/guides/getting-started/set-up/hedera) for installation instructions.

## AnonCreds registry integration

The Hedera DID resolver, registrar, and module are available from the package root without installing AnonCreds:

```ts
import { HederaDidRegistrar, HederaDidResolver, HederaModule } from '@credo-ts/hedera'
```

To use Hedera as an AnonCreds registry, install `@credo-ts/anoncreds` and `@hiero-did-sdk/anoncreds` explicitly and
import the registry from the AnonCreds integration entry point. `HederaModule` must also be registered, as the registry
uses its configuration:

```ts
import { AnonCredsModule } from '@credo-ts/anoncreds'
import { HederaModule } from '@credo-ts/hedera'
import { HederaAnonCredsRegistry } from '@credo-ts/hedera/anoncreds'

const modules = {
  hedera: new HederaModule({
    networks: [{ network: 'testnet', operatorId: '<operator-id>', operatorKey: '<operator-key>' }],
  }),
  anoncreds: new AnonCredsModule({
    registries: [new HederaAnonCredsRegistry()],
  }),
}
```

`@credo-ts/anoncreds` and `@hiero-did-sdk/anoncreds` are optional peer dependencies of `@credo-ts/hedera` and are only
required when using this integration. `HederaAnonCredsRegistry` is not exported from the `@credo-ts/hedera` package
root, and the AnonCreds methods formerly on `HederaLedgerService` have been removed.
