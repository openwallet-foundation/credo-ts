<p align="center">
  <br />
  <img
    alt="Hyperledger Aries logo"
    src="https://raw.githubusercontent.com/hyperledger/aries-framework-javascript/aa31131825e3331dc93694bc58414d955dcb1129/images/aries-logo.png"
    height="250px"
  />
</p>
<h1 align="center"><b>Aries Framework JavaScript Open ID Connect For Verifiable Credentials Client Module</b></h1>
<p align="center">
  <a
    href="https://raw.githubusercontent.com/hyperledger/aries-framework-javascript/main/LICENSE"
    ><img
      alt="License"
      src="https://img.shields.io/badge/License-Apache%202.0-blue.svg"
  /></a>
  <a href="https://www.typescriptlang.org/"
    ><img
      alt="typescript"
      src="https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg"
  /></a>
    <a href="https://www.npmjs.com/package/@aries-framework/openid4vc-client"
    ><img
      alt="@aries-framework/openid4vc-client version"
      src="https://img.shields.io/npm/v/@aries-framework/openid4vc-client"
  /></a>

</p>
<br />

Open ID Connect For Verifiable Credentials Client Module for [Aries Framework JavaScript](https://github.com/hyperledger/aries-framework-javascript).

### Installation

Make sure you have set up the correct version of Aries Framework JavaScript according to the AFJ repository.

```sh
yarn add @aries-framework/openid4vc-client
```

### Quick start

#### Requirements

Before a credential can be requested, you need the issuer URI. This URI starts with `openid-initiate-issuance://` and is provided by the issuer. The issuer URI is commonly acquired by scanning a QR code.

#### Module registration

In order to get this module to work, we need to inject it into the agent. This makes the module's functionality accessible through the agent's `modules` api.

```ts
import { OpenId4VcClientModule } from '@aries-framework/openid4vc-client'

const agent = new Agent({
  config: {
    /* config */
  },
  dependencies: agentDependencies,
  modules: {
    openId4VcClient: new OpenId4VcClientModule(),
    /* other custom modules */
  },
})

await agent.initialize()
```

How the module is injected and the agent has been initialized, you can access the module's functionality through `agent.modules.openId4VcClient`.

#### Preparing a DID

In order to request a credential, you'll need to provide a DID that the issuer will use for setting the credential subject. In the following snippet we create one for the sake of the example, but this can be any DID that has a _authentication verification method_ with key type `Ed25519`.

```ts
// first we create the DID
const did = await agent.dids.create<KeyDidCreateOptions>({
  method: 'key',
  options: {
    keyType: KeyType.Ed25519,
  },
})

// next we do some assertions and extract the key identifier (kid)

if (
  !did.didState.didDocument ||
  !did.didState.didDocument.authentication ||
  did.didState.didDocument.authentication.length === 0
) {
  throw new Error("Error creating did document, or did document has no 'authentication' verificationMethods")
}

const [verificationMethod] = did.didState.didDocument.authentication
const kid = typeof verificationMethod === 'string' ? verificationMethod : verificationMethod.id
```

#### Requesting the credential (Pre-Authorized)

Now a credential issuance can be requested as follows.

```ts
const w3cCredentialRecord = await agent.modules.openId4VcClient.requestCredentialPreAuthorized({
  issuerUri,
  kid,
  checkRevocationState: false,
})

console.log(w3cCredentialRecord)
```

#### Full example

```ts
import { OpenId4VcClientModule } from '@aries-framework/openid4vc-client'
import { agentDependencies } from '@aries-framework/node' // use @aries-framework/react-native for React Native
import { Agent, KeyDidCreateOptions } from '@aries-framework/core'

const run = async () => {
  const issuerUri = '' // The obtained issuer URI

  // Create the Agent
  const agent = new Agent({
    config: {
      /* config */
    },
    dependencies: agentDependencies,
    modules: {
      openId4VcClient: new OpenId4VcClientModule(),
      /* other custom modules */
    },
  })

  // Initialize the Agent
  await agent.initialize()

  // Create a DID
  const did = await agent.dids.create<KeyDidCreateOptions>({
    method: 'key',
    options: {
      keyType: KeyType.Ed25519,
    },
  })

  // Assert DIDDocument is valid
  if (
    !did.didState.didDocument ||
    !did.didState.didDocument.authentication ||
    did.didState.didDocument.authentication.length === 0
  ) {
    throw new Error("Error creating did document, or did document has no 'authentication' verificationMethods")
  }

  // Extract key identified (kid) for authentication verification method
  const [verificationMethod] = did.didState.didDocument.authentication
  const kid = typeof verificationMethod === 'string' ? verificationMethod : verificationMethod.id

  // Request the credential
  const w3cCredentialRecord = await agent.modules.openId4VcClient.requestCredentialPreAuthorized({
    issuerUri,
    kid,
    checkRevocationState: false,
  })

  // Log the received credential
  console.log(w3cCredentialRecord)
}
```
