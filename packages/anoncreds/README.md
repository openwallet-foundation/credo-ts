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

Import the AnonCreds and legacy Indy DIDComm formats and protocols from the DIDComm integration entry point:

```ts
import {
  AnonCredsDidCommCredentialFormatService,
  AnonCredsDidCommProofFormatService,
  DidCommCredentialV1Protocol,
  DidCommProofV1Protocol,
} from '@credo-ts/anoncreds/didcomm'
```

The DIDComm APIs are no longer exported from the `@credo-ts/anoncreds` package root. This change only affects
their import paths; AnonCreds support for DIDComm credential and proof exchanges is unchanged.
