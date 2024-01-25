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
  <a href="https://www.typescriptlang.org/"
    ><img
      alt="typescript"
      src="https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg"
  /></a>
</p>
<br />

<p align="center">
  <a href="#features">Features</a> &nbsp;|&nbsp;
  <a href="#getting-started">Getting started</a> &nbsp;|&nbsp;
  <a href="#contributing">Contributing</a> &nbsp;|&nbsp;
  <a href="#license">License</a> 
</p>

Aries Framework JavaScript is a framework written in TypeScript for building **SSI Agents and DIDComm services** that aims to be **compliant and interoperable** with the standards defined in the [Aries RFCs](https://github.com/hyperledger/aries-rfcs).

> **Note**
> The Aries Framework JavaScript project has recently been moved from the Hyperledger Foundation to the Open Wallet Foundation.
> We are currently in the process of changing the name of the project, and updating all the documentation and links to reflect this change.
> You may encounter some broken links, or references to the old name, but we are working hard to fix this. Once the new name has been decided
> we will update this README and all the documentation to reflect this change.
> You can follow this discussion for updates about the name: https://github.com/openwallet-foundation/agent-framework-javascript/discussions/1668

## Features

- 🏃 Runs in React Native & Node.JS
- 🔒 DIDComm v1 support
- 🌎 [Aries Interop Profile](https://github.com/hyperledger/aries-rfcs/blob/main/concepts/0302-aries-interop-profile/README.md) v1 & v2 support
  - With support for Chat, Mediator Coordination, Indy Credentials & and JSON-LD Credentials sub-targets
- `did:sov`, `did:web`, `did:key` and `did:peer`, with pluggable interface for registering custom did methods.
- OpenID for Verifiable Credential Issuance (only receiving JSON-LD credentials for now)
- 💡 Smart Auto Acceptance of Connections, Credentials and Proofs
- 🏢 Multi tenant module for managing multiple tenants under a single agent.

### Packages

<table>
  <tr>
    <th><b>Package</b></th>
    <th><b>Version</b></th>
  </tr>
  <tr>
    <td>@aries-framework/core</td>
    <td>
      <a href="https://npmjs.com/package/@aries-framework/core">
        <img alt="@aries-framework/core version" src="https://img.shields.io/npm/v/@aries-framework/core"/>
      </a>
    </td>
  </tr>
  <tr>
    <td>@aries-framework/node</td>
    <td>
      <a href="https://npmjs.com/package/@aries-framework/node">
        <img alt="@aries-framework/node version" src="https://img.shields.io/npm/v/@aries-framework/node"/>
      </a>
    </td>
  </tr>
  <tr>
    <td>@aries-framework/react-native</td>
    <td>
      <a href="https://npmjs.com/package/@aries-framework/react-native">
        <img alt="@aries-framework/react-native version" src="https://img.shields.io/npm/v/@aries-framework/react-native"/>
      </a>
    </td>
  </tr>
  <tr>
    <td>@aries-framework/indy-sdk</td>
    <td>
      <a href="https://npmjs.com/package/@aries-framework/indy-sdk">
        <img alt="@aries-framework/indy-sdk version" src="https://img.shields.io/npm/v/@aries-framework/indy-sdk"/>
      </a>
    </td>
  </tr>
  <tr>
    <td>@aries-framework/indy-vdr</td>
    <td>
      <a href="https://npmjs.com/package/@aries-framework/indy-vdr">
        <img alt="@aries-framework/indy-vdr version" src="https://img.shields.io/npm/v/@aries-framework/indy-vdr"/>
      </a>
    </td>
  </tr>
  <tr>
    <td>@aries-framework/cheqd</td>
    <td>
      <a href="https://npmjs.com/package/@aries-framework/cheqd">
        <img alt="@aries-framework/cheqd version" src="https://img.shields.io/npm/v/@aries-framework/cheqd"/>
      </a>
    </td>
  </tr>  
  <tr>
    <td>@aries-framework/askar</td>
    <td>
      <a href="https://npmjs.com/package/@aries-framework/askar">
        <img alt="@aries-framework/askar version" src="https://img.shields.io/npm/v/@aries-framework/askar"/>
      </a>
    </td>
  </tr>
  <tr>
    <td>@aries-framework/anoncreds</td>
    <td>
      <a href="https://npmjs.com/package/@aries-framework/anoncreds">
        <img alt="@aries-framework/anoncreds version" src="https://img.shields.io/npm/v/@aries-framework/anoncreds"/>
      </a>
    </td>
  </tr>
  <tr>
    <td>@aries-framework/anoncreds-rs</td>
    <td>
      <a href="https://npmjs.com/package/@aries-framework/anoncreds-rs">
        <img alt="@aries-framework/anoncreds-rs version" src="https://img.shields.io/npm/v/@aries-framework/anoncreds-rs"/>
      </a>
    </td>
  </tr>
  <tr>
    <td>@aries-framework/openid4vc-client</td>
    <td>
      <a href="https://npmjs.com/package/@aries-framework/openid4vc-client">
        <img alt="@aries-framework/openid4vc-client version" src="https://img.shields.io/npm/v/@aries-framework/openid4vc-client"/>
      </a>
    </td>
  </tr>
   <tr>
    <td>@aries-framework/action-menu</td>
    <td>
      <a href="https://npmjs.com/package/@aries-framework/action-menu">
        <img alt="@aries-framework/action-menu version" src="https://img.shields.io/npm/v/@aries-framework/action-menu"/>
      </a>
    </td>
  </tr>
    <td>@aries-framework/question-answer</td>
    <td>
      <a href="https://npmjs.com/package/@aries-framework/question-answer">
        <img alt="@aries-framework/question-answer version" src="https://img.shields.io/npm/v/@aries-framework/question-answer"/>
      </a>
    </td>
  </tr>
  <tr>
    <td>@aries-framework/tenants</td>
    <td>
      <a href="https://npmjs.com/package/@aries-framework/tenants">
        <img alt="@aries-framework/tenants version" src="https://img.shields.io/npm/v/@aries-framework/tenants"/>
      </a>
    </td>
  </tr>
</table>

## Getting Started

Documentation on how to get started with Aries Framework JavaScript can be found at https://aries.js.org

### Demo

To get to know the AFJ flow, we built a demo to walk through it yourself together with agents Alice and Faber.

- [Demo](/demo)

### Divergence from Aries RFCs

Although Aries Framework JavaScript tries to follow the standards as described in the Aries RFCs as much as possible, some features in AFJ slightly diverge from the written spec. Below is an overview of the features that diverge from the spec, their impact and the reasons for diverging.

| Feature                                                                                                                                                        | Impact                                                                                                                                                                                                                                                                                                                                                                                                                          | Reason                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Support for `imageUrl` attribute in connection invitation and connection request                                                                               | Properties that are not recognized should be ignored, meaning this shouldn't limit interoperability between agents. As the image url is self-attested it could give a false sense of trust. Better, credential based, method for visually identifying an entity are not present yet.                                                                                                                                            | Even though not documented, almost all agents support this feature. Not including this feature means AFJ is lacking in features in comparison to other implementations. |
| Revocation Notification v1 uses a different `thread_id` format ( `indy::<revocation_registry_id>::<credential_revocation_id>`) than specified in the Aries RFC | Any agents adhering to the [revocation notification v1 RFC](https://github.com/hyperledger/aries-rfcs/tree/main/features/0183-revocation-notification) will not be interoperable with Aries Framework Javascript. However, revocation notification is considered an optional portion of revocation, therefore this will not break core revocation behavior. Ideally agents should use and implement revocation notification v2. | Actual implementations (ACA-Py) of revocation notification v1 so far have implemented this different format, so this format change was made to remain interoperable.    |

## Contributing

If you would like to contribute to the framework, please read the [Framework Developers README](/DEVREADME.md) and the [CONTRIBUTING](/CONTRIBUTING.md) guidelines. These documents will provide more information to get you started!

There are regular community working groups to discuss ongoing efforts within the framework, showcase items you've built with Credo, or ask questions. See [Meeting Information](https://github.com/openwallet-foundation/credo-ts/wiki/Meeting-Information) for up to date information on the meeting schedule. Everyone is welcome to join!

## License

Hyperledger Aries Framework JavaScript is licensed under the [Apache License Version 2.0 (Apache-2.0)](/LICENSE).
