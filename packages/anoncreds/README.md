<p align="center">
  <br />
  <img
    alt="Credo Logo"
    src="https://github.com/openwallet-foundation/credo-ts/blob/c7886cb8377ceb8ee4efe8d264211e561a75072d/images/credo-logo.png"
    height="250px"
  />
</p>
<h1 align="center"><b>Credo AnonCreds Module</b></h1>
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
    <a href="https://www.npmjs.com/package/@credo-ts/anoncreds"
    ><img
      alt="@credo-ts/anoncreds version"
      src="https://img.shields.io/npm/v/@credo-ts/anoncreds"
  /></a>

</p>
<br />

Credo AnonCreds provides AnonCreds capabilities of Credo. See the [AnonCreds Setup](https://credo.js.org/guides/getting-started/set-up/anoncreds) for installation instructions.

## Package entry points

Import the AnonCreds module, services, repositories, models, and W3C proof APIs from the package root:

```ts
import {
  AnonCredsModule,
  AnonCredsW3cCredentialProof,
  ANONCREDS_W3C_CREDENTIAL_CRYPTOSUITE,
} from '@credo-ts/anoncreds'
```

Import the AnonCreds DIDComm formats from the DIDComm integration entry point:

```ts
import { AnonCredsDidCommCredentialFormatService, AnonCredsDidCommProofFormatService } from '@credo-ts/anoncreds/didcomm'
```

The package root does not load DIDComm. `@credo-ts/didcomm` is an optional peer dependency; install it when
using the DIDComm integration.

To enable the `anoncreds_link_secret` binding method in the DIDComm Data Integrity credential format,
pass its provider explicitly. Registering `AnonCredsModule` no longer configures this binding automatically.

```ts
import { AnonCredsLinkSecretBindingProvider } from '@credo-ts/anoncreds/didcomm'
import { DidCommDataIntegrityCredentialFormatService } from '@credo-ts/didcomm'

const dataIntegrityFormat = new DidCommDataIntegrityCredentialFormatService({
  linkSecretBinding: new AnonCredsLinkSecretBindingProvider(),
})
```

Without this option, the format's other binding methods remain available. The former
`DidCommDataIntegrityLinkSecretBindingProviderToken` has been removed.

The auto-accept helpers `composeCredentialAutoAccept` and `composeProofAutoAccept` are available from
`@credo-ts/anoncreds/didcomm`, not the kernel utilities.

### Legacy storage upgrades

The existing storage upgrade sequence is preserved. Historical DIDComm migrations load
`@credo-ts/didcomm` on demand rather than when importing the AnonCreds module. Install DIDComm when upgrading
storage that requires those migrations: the 0.3.1-to-0.4 exchange-record migration, or the 0.4-to-0.5
conversion of legacy AnonCreds credentials and their exchange-record bindings. A missing dependency fails
the migration rather than silently skipping the exchange-record updates. Fresh stores do not require it.
