<p align="center">
  <br />
  <img
    alt="Hyperledger Aries logo"
    src="https://raw.githubusercontent.com/hyperledger/aries-framework-javascript/aa31131825e3331dc93694bc58414d955dcb1129/images/aries-logo.png"
    height="250px"
  />
</p>
<h1 align="center"><b>Aries Framework JavaScript Selective Disclosure JWT VC Module</b></h1>
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
    <a href="https://www.npmjs.com/package/@aries-framework/sd-jwt-vc"
    ><img
      alt="@aries-framework/sd-jwt-vc version"
      src="https://img.shields.io/npm/v/@aries-framework/sd-jwt-vc"
  /></a>
</p>
<br />

### Installation

Add the `sd-jwt-vc` module to your project.

```sh
yarn add @aries-framework/sd-jwt-vc
```

### Quick start

After the installation you can follow the [guide to setup your agent](https://aries.js.org/guides/0.4/getting-started/set-up) and add the following to your agent modules.

```ts
import { SdJwtVcModule } from '@aries-framework/sd-jwt-vc'

const agent = new Agent({
  config: {
    /* config */
  },
  dependencies: agentDependencies,
  modules: {
    sdJwtVc: new SdJwtVcModule(),
    /* other custom modules */
  },
})

await agent.initialize()
```
