<p align="center">
  <br />
  <img
    alt="Hyperledger Aries logo"
    src="https://raw.githubusercontent.com/hyperledger/aries-framework-javascript/aa31131825e3331dc93694bc58414d955dcb1129/images/aries-logo.png"
    height="250px"
  />
</p>
<h1 align="center"><b>Aries Framework JavaScript - DidComm V2 Module</b></h1>
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
    <a href="https://www.npmjs.com/package/@aries-framework/bbs-signatures"
    ><img
      alt="@aries-framework/bbs-signatures version"
      src="https://img.shields.io/npm/v/@aries-framework/bbs-signatures"
  /></a>

</p>
<br />

Aries Framework JavaScript DidComm V2 Module provides an optional addon to Aries Framework JavaScript to support [DID Comm V2 messages](https://identity.foundation/didcomm-messaging/spec/).

## Installation

```sh
yarn add @aries-framework/didcomm-v2
```

### Usage

- NodeJS - [didcomm-node](https://www.npmjs.com/package/didcomm-node) package should be added into project dependencies and passed as a parameter into module constructor.

  ```
      import * as didcomm from 'didcomm-node'

      const didcommV2Module = new DidCommV2Module({ didcomm })
      didcommV2Module.register(this.agent.dependencyManager)
  ```

- React Native - [@sicpa_open_source/didcomm-react-native](https://www.npmjs.com/package/@sicpa_open_source/didcomm-react-native) package should be added into project dependencies and passed as a parameter into module constructor.

  ```
      import * as didcomm from '@sicpa_open_source/didcomm-react-native'

      const didcommV2Module = new DidCommV2Module({ didcomm })
      didcommV2Module.register(this.agent.dependencyManager)
  ```
