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
    <a href="https://www.npmjs.com/package/@aries-framework/openid4vc-holder"
    ><img
      alt="@aries-framework/openid4vc-holder version"
      src="https://img.shields.io/npm/v/@aries-framework/openid4vc-holder"
  /></a>

</p>
<br />

Open ID Connect For Verifiable Credentials Holder Module for [Aries Framework JavaScript](https://github.com/hyperledger/aries-framework-javascript).

### Installation

Make sure you have set up the correct version of Aries Framework JavaScript according to the AFJ repository.

```sh
yarn add @aries-framework/openid4vc-holder
```

### Quick start

#### Requirements

Before a credential can be requested, you need the issuer URI. This URI starts with `openid-initiate-issuance://` and is provided by the issuer. The issuer URI is commonly acquired by scanning a QR code.

#### Module registration

In order to get this module to work, we need to inject it into the agent. This makes the module's functionality accessible through the agent's `modules` api.

```ts
import { OpenId4VcHolderModule } from '@aries-framework/openid4vc-holder'

const agent = new Agent({
  config: {
    /* config */
  },
  dependencies: agentDependencies,
  modules: {
    openId4VcHolder: new OpenId4VcHolderModule(),
    /* other custom modules */
  },
})

await agent.initialize()
```

How the module is injected and the agent has been initialized, you can access the module's functionality through `agent.modules.openId4VcHolder`.

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

```ts
// To request credentials(s), you need a credential offer.
// The credential offer be provided as actual payload,
// the credential offer URL or issuance initiation URL
const credentialOffer =
  'openid-credential-offer://?credential_offer=%7B%22credential_issuer%22%3A%22https%3A%2F%2Fjff.walt.id%2Fissuer-api%2Fdefault%2Foidc%22%2C%22credentials%22%3A%5B%22VerifiableId%22%2C%20%22VerifiableDiploma%22%5D%2C%22grants%22%3A%7B%22urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Apre-authorized_code%22%3A%7B%22pre-authorized_code%22%3A%22ABC%22%7D%7D%7D'

// The first step is to resolve the credential offer and
// get all metadata required for the issuance of the credentials.
const resolvedCredentialOffer = await agent.modules.openId4VcHolder.resolveCredentialOffer(credentialOffer)

// The second (optional) step is to filter out the credentials which you want to request.
const selectedCredentialsForRequest = resolvedCredentialOffer.credentialsToRequest.filter((credential) => {
  return credential.format === OpenIdCredentialFormatProfile.JwtVcJson && credential.types.includes('VerifiableId')
})

// The third step is to accept the credential offer.
// If no credentialsToRequest are specified all offered credentials are requested.
const w3cCredentialRecords = await agent.modules.openId4VcHolder.acceptCredentialOfferUsingPreAuthorizedCode(
  resolvedCredentialOffer,
  {
    allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.ES256],
    proofOfPossessionVerificationMethodResolver: () => verificationMethod,
    verifyCredentialStatus: false,
    credentialsToRequest: selectedCredentialsForRequest,
  }
)

console.log(w3cCredentialRecords)
```

#### Requesting the credential (Authorization Code Flow)

Requesting credentials via the Authorization Code Flow function conceptually similar,
except that there is an intermediary step involved to resolve the authorization request, and then manually get the authorization code.

```ts
// To request credentials(s), you need a credential offer.
// The credential offer be provided as actual payload,
// the credential offer URL or issuance initiation URL
const credentialOffer = `openid-credential-offer://?credential_offer=%7B%22credential_issuer%22%3A%22https%3A%2F%2Fissuer.portal.walt.id%22%2C%22credentials%22%3A%5B%7B%22format%22%3A%22jwt_vc_json%22%2C%22types%22%3A%5B%22VerifiableCredential%22%2C%22OpenBadgeCredential%22%5D%2C%22credential_definition%22%3A%7B%22%40context%22%3A%5B%22https%3A%2F%2Fwww.w3.org%2F2018%2Fcredentials%2Fv1%22%2C%22https%3A%2F%2Fpurl.imsglobal.org%2Fspec%2Fob%2Fv3p0%2Fcontext.json%22%5D%2C%22types%22%3A%5B%22VerifiableCredential%22%2C%22OpenBadgeCredential%22%5D%7D%7D%5D%2C%22grants%22%3A%7B%22authorization_code%22%3A%7B%22issuer_state%22%3A%22b0e16785-d722-42a5-a04f-4beab28e03ea%22%7D%2C%22urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Apre-authorized_code%22%3A%7B%22pre-authorized_code%22%3A%22eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJiMGUxNjc4NS1kNzIyLTQyYTUtYTA0Zi00YmVhYjI4ZTAzZWEiLCJpc3MiOiJodHRwczovL2lzc3Vlci5wb3J0YWwud2FsdC5pZCIsImF1ZCI6IlRPS0VOIn0.ibEpHFaHFBLWyhEf4SotDQZBeh_FMrfncWapNox1Iv1kdQWQ2cLQeS1VrCyVmPsbx0tN2MAyDFG7DnAaq8MiAA%22%2C%22user_pin_required%22%3Afalse%7D%7D%7D`

// The first step is to resolve the credential offer and
// get all metadata required for the issuance of the credentials.
const resolvedCredentialOffer = await agent.modules.openId4VcHolder.resolveCredentialOffer(credentialOffer)

// The second step is the resolve the authorization request.
const resolvedAuthorizationRequest = await agent.modules.openId4VcHolder.resolveAuthorizationRequest(resolved, {
  clientId: 'test-client',
  redirectUri: 'http://blank',
  scope: ['openid', 'OpenBadgeCredential'],
})

// The resolved authorization request contains the authorizationRequestUri,
// which can be used to obtain the actual authorization code.
// Currently, this needs to be done manually
const code =
  'eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJiMGUxNjc4NS1kNzIyLTQyYTUtYTA0Zi00YmVhYjI4ZTAzZWEiLCJpc3MiOiJodHRwczovL2lzc3Vlci5wb3J0YWwud2FsdC5pZCIsImF1ZCI6IlRPS0VOIn0.ibEpHFaHFBLWyhEf4SotDQZBeh_FMrfncWapNox1Iv1kdQWQ2cLQeS1VrCyVmPsbx0tN2MAyDFG7DnAaq8MiAA'

// The third (optional) step is to filter out the credentials which you want to request.
const selectedCredentialsForRequest = resolvedCredentialOffer.credentialsToRequest.filter((credential) => {
  return credential.format === OpenIdCredentialFormatProfile.JwtVcJson && credential.types.includes('VerifiableId')
})

// The fourth step is to accept the credential offer.
// If no credentialsToRequest are specified all offered credentials are requested.
const w3cCredentialRecords = await agent.modules.openId4VcHolder.acceptCredentialOfferUsingAuthorizationCode(
  resolvedCredentialOffer,
  resolvedAuthorizationRequest,
  code,
  {
    allowedProofOfPossessionSignatureAlgorithms: [JwaSignatureAlgorithm.ES256],
    proofOfPossessionVerificationMethodResolver: () => verificationMethod,
    verifyCredentialStatus: false,
    credentialsToRequest: selectedCredentialsForRequest,
  }
)

console.log(w3cCredentialRecords)
```
