<p align="center">
  <br />
  <img
    alt="Hyperledger Aries logo"
    src="https://raw.githubusercontent.com/hyperledger/aries-framework-javascript/aa31131825e3331dc93694bc58414d955dcb1129/images/aries-logo.png"
    height="250px"
  />
</p>
<h1 align="center"><b>Aries Framework JavaScript</b></h1>
<p align="center">
  <img
    alt="Pipeline Status"
    src="https://github.com/hyperledger/aries-framework-javascript/workflows/Continuous%20Integration/badge.svg?branch=main"
  />
  <a
    href="https://lgtm.com/projects/g/hyperledger/aries-framework-javascript/context:javascript"
    ><img
      alt="Language grade: JavaScript"
      src="https://img.shields.io/lgtm/grade/javascript/g/hyperledger/aries-framework-javascript.svg?logo=lgtm&logoWidth=18"
  /></a>
  <a href="https://codecov.io/gh/hyperledger/aries-framework-javascript/"
    ><img
      alt="Codecov Coverage"
      src="https://img.shields.io/codecov/c/github/hyperledger/aries-framework-javascript/coverage.svg?style=flat-square"
  /></a>
  <a
    href="https://raw.githubusercontent.com/hyperledger/aries-framework-javascript/main/LICENSE"
    ><img
      alt="License"
      src="https://img.shields.io/badge/License-Apache%202.0-blue.svg"
  /></a>
  <a href="https://npmjs.com/package/aries-framework-javascript"
    ><img
      alt="aries-framework-javascript npm version"
      src="https://img.shields.io/npm/v/aries-framework"
  /></a>
</p>
<br />

<p align="center">
  <a href="#features">Features</a> &nbsp;|&nbsp;
  <a href="#getting-started">Getting started</a> &nbsp;|&nbsp;
  <a href="#contributing">Contributing</a> &nbsp;|&nbsp;
  <a href="#license">License</a> 
</p>

Aries Framework JavaScript is a typescript framework for building **SSI Agents and DIDComm services** that aims to be **compliant and interoperable** with the standards defined in the [Aries RFCs](https://github.com/hyperledger/aries-rfcs).

## Features

Some features are not yet supported, but are on our roadmap. Check [the roadmap](https://github.com/hyperledger/aries-framework-javascript/issues/39) for more information.

- ✅ React Native
- ✅ Node.JS
- ✅ Issue Credential Protocol ([RFC 0036](https://github.com/hyperledger/aries-rfcs/blob/master/features/0036-issue-credential/README.md))
- ✅ Present Proof Protocol ([RFC 0037](https://github.com/hyperledger/aries-rfcs/tree/master/features/0037-present-proof/README.md))
- ✅ Connection Protocol ([RFC 0160](https://github.com/hyperledger/aries-rfcs/blob/master/features/0160-connection-protocol/README.md))
- ✅ Basic Message Protocol ([RFC 0095](https://github.com/hyperledger/aries-rfcs/blob/master/features/0095-basic-message/README.md))
- ✅ Indy Credentials (with `did:sov` support)
- ✅ HTTP Transport
- 🚧 Revocation of Indy Credentials
- 🚧 Electron
- 🚧 Mediator Coordination Protocol ([RFC 0211](https://github.com/hyperledger/aries-rfcs/blob/master/features/0211-route-coordination/README.md))
- 🚧 WebSocket Transport
- ❌ Browser
- ❌ Connection-less Issuance and Verification
- ❌ Issue Credential V2, Present Proof V2, DID Exchange Protocol, Out-Of-Band
- ❌ W3C Linked Data VCs, BBS+ Signatures

## Getting Started

- NodeJS: [setup guide](./docs/setup-nodejs.md)
- React Native: [setup guide](./docs/setup-react-native.md)
- Electron: [setup guide](./docs/setup-electron.md)

## Contributing

If you would like to contribute to the framework, please read the [Framework Developers README](DEVREADME.md) and the [CONTRIBUTING](CONTRIBUTING.md) guidelines. These documents will provide more information to get you started!

## License

Hyperledger Aries Framework JavaScript is licensed under the [Apache License Version 2.0 (Apache-2.0)](LICENSE).
