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

The AnonCreds package root has no static or dynamic import or public type dependency on DIDComm.
`@credo-ts/didcomm` is an optional peer dependency; install it only when using the DIDComm integration.

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

**Only users upgrading from a version of Credo TS before v0.5.x whose stores still need legacy
migration need to configure `AnonCredsDidCommMigrationProvider`, and only to preserve their historical
DIDComm exchange-record links.** Applications whose stores were created with v0.5.x or later do not
need this provider, even when using DIDComm. Older stores that have already completed migration to
storage version 0.5 do not need it either.

The existing storage upgrade sequence is preserved. Applications upgrading from storage version 0.3.1
run the 0.3.1-to-0.4 and 0.4-to-0.5 migrations; applications at storage version 0.4 run only the latter.
Storage versions are independent of package versions. Fresh stores and stores already at version 0.5
do not need this integration.

When upgrading from Credo TS before v0.5.x, to preserve historical DIDComm exchange records, supply the migration
provider and register the DIDComm credentials module before upgrading:

```ts
import { AnonCredsModule } from '@credo-ts/anoncreds'
import { AnonCredsDidCommMigrationProvider } from '@credo-ts/anoncreds/didcomm'

const anoncreds = new AnonCredsModule({
  anoncreds: NativeAnoncreds,
  registries: [registry],
  migrationProvider: new AnonCredsDidCommMigrationProvider(),
})
```

This configuration works for both manual `UpdateAssistant` upgrades and automatic startup upgrades.
It is not required for normal AnonCreds or DIDComm operation after the migrations have completed.
Migrations never load or discover DIDComm automatically. If no provider is configured or
the DIDComm credentials repository is not registered:

- The 0.3.1-to-0.4 migration skips DIDComm exchange-record updates with a warning; other AnonCreds migration
  steps still run.
- The 0.4-to-0.5 migration converts legacy AnonCreds credentials to W3C records and deletes the legacy
  credentials, but skips exchange-record relinking with warnings identifying the affected legacy records.

Storage versioning advances after a successful upgrade. Skipped exchange-record updates are not automatically
retried if DIDComm is enabled later. The migrated credentials remain usable through the standalone AnonCreds APIs,
but historical exchange references may be stale. Standalone applications can omit the provider and DIDComm entirely.
Unexpected dependency resolution, conversion, or storage errors still fail the migration.
