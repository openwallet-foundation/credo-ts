<p align="center">
  <br />
  <img
    alt="Hyperledger Aries logo"
    src="https://raw.githubusercontent.com/hyperledger/aries-framework-javascript/aa31131825e3331dc93694bc58414d955dcb1129/images/aries-logo.png"
    height="250px"
  />
</p>
<h1 align="center"><b>Aries Framework JavaScript Selective Disclosure JWT Module</b></h1>
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
    <a href="https://www.npmjs.com/package/@aries-framework/sd-jwt"
    ><img
      alt="@aries-framework/sd-jwt version"
      src="https://img.shields.io/npm/v/@aries-framework/sd-jwt"
  /></a>

</p>
<br />

### Installation

Make sure you have set up the correct version of Aries Framework JavaScript according to the AFJ repository. To find out which version of AFJ you need to have installed you can run the following command. This will list the required peer dependency for `@aries-framework/core`.

```sh
npm info "@aries-framework/sd-jwt" peerDependencies
```

Then add the sd-jwt module to your project.

```sh
yarn add @aries-framework/sd-jwt
```

### Quick start

In order for this module to work, we have to inject it into the agent to access agent functionality. See the example for more information.

### Example of usage

```ts
import { SdJwtModule } from '@aries-framework/sd-jwt'

const agent = new Agent({
    config: {
        /* config */
    },
    dependencies: agentDependencies,
    modules: {
        sdJwt: new SdJwtModule(),
        /* other custom modules */
    },
})

await agent.initialize()
```
