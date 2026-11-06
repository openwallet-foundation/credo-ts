<p align="center">
  <br />
  <img
    alt="Credo Logo"
    src="https://github.com/openwallet-foundation/credo-ts/blob/c7886cb8377ceb8ee4efe8d264211e561a75072d/images/credo-logo.png"
    height="250px"
  />
</p>
<h1 align="center"><b>Credo Cheqd Module</b></h1>
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
    <a href="https://www.npmjs.com/package/@credo-ts/cheqd"
    ><img
      alt="@credo-ts/cheqd version"
      src="https://img.shields.io/npm/v/@credo-ts/cheqd"
  /></a>

</p>
<br />

Credo cheqd provides integration of the cheqd network into Credo. See the [Cheqd Setup](https://credo.js.org/guides/getting-started/set-up/cheqd) for installation instructions.

## AnonCreds registry integration

The Cheqd DID resolver, registrar, and module are available from the package root without installing AnonCreds:

```ts
import { CheqdDidRegistrar, CheqdDidResolver, CheqdModule } from '@credo-ts/cheqd'
```

To use Cheqd as an AnonCreds registry, install `@credo-ts/anoncreds` explicitly and import the registry from the
AnonCreds integration entry point:

```ts
import { AnonCredsModule } from '@credo-ts/anoncreds'
import { CheqdAnonCredsRegistry } from '@credo-ts/cheqd/anoncreds'

const anoncreds = new AnonCredsModule({
  registries: [new CheqdAnonCredsRegistry()],
})
```

`@credo-ts/anoncreds` is an optional peer dependency of `@credo-ts/cheqd` and is only required when using this
integration. `CheqdAnonCredsRegistry` is not exported from the `@credo-ts/cheqd` package root.
