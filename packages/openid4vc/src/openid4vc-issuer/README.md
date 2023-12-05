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
    <a href="https://www.npmjs.com/package/@aries-framework/openid4vc-issuer"
    ><img
      alt="@aries-framework/openid4vc-issuer version"
      src="https://img.shields.io/npm/v/@aries-framework/openid4vc-issuer"
  /></a>

</p>
<br />

Open ID Connect For Verifiable Credentials Issuer Module for [Aries Framework JavaScript](https://github.com/hyperledger/aries-framework-javascript).

### Installation

Make sure you have set up the correct version of Aries Framework JavaScript according to the AFJ repository.

```sh
yarn add @aries-framework/openid4vc-issuer
```

### Quick start

#### Requirements

#### Module registration

In order to get this module to work, we need to inject it into the agent. This makes the module's functionality accessible through the agent's `modules` api.

```ts
import { OpenId4VcIssuerModule } from '@aries-framework/openid4vc-issuer'

const agent = new Agent({
  config: {
    /* config */
  },
  dependencies: agentDependencies,
  modules: {
    openId4VcIssuer: new OpenId4VcIssuerModule(),
    /* other custom modules */
  },
})

await agent.initialize()
```

How the module is injected and the agent has been initialized, you can access the module's functionality through `agent.modules.openId4VcIssuer`.

#### Preparing a DID
