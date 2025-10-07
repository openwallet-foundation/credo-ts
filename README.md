<p align="center">
  <br />
  <img
    alt="Credo Logo"
    src="https://raw.githubusercontent.com/openwallet-foundation/credo-ts/c7886cb8377ceb8ee4efe8d264211e561a75072d/images/credo-logo.png"
    height="250px"
  />
</p>
<h1 align="center"><b>Credo</b></h1>
<p align="center">
  <img
    alt="Pipeline Status"
    src="https://github.com/openwallet-foundation/credo-ts/workflows/Continuous%20Integration/badge.svg?branch=main"
  />
  <a href="https://codecov.io/gh/openwallet-foundation/credo-ts/"
    ><img
      alt="Codecov Coverage"
      src="https://img.shields.io/codecov/c/github/openwallet-foundation/credo-ts/coverage.svg?style=flat-square"
  /></a>
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
</p>
<br />

<p align="center">
  <a href="#quickstart">Quickstart</a> &nbsp;|&nbsp;
  <a href="#features">Features</a> &nbsp;|&nbsp;
  <a href="#contributing">Contributing</a> &nbsp;|&nbsp;
  <a href="#license">License</a> 
</p>

Credo is a framework written in TypeScript for building **decentralized identity solutions** that aims to be compliant and **interoperable with identity standards across the world**. Credo is agnostic to any specific exchange protocol, credential format, signature suite or did method, but currently mainly focuses on alignment with [OpenID4VC](https://openid.net/sg/openid4vc/), [DIDComm](https://identity.foundation/didcomm-messaging/spec/) and [Hyperledger Aries](https://hyperledger.github.io/aries-rfcs/latest/).

## Quickstart

Documentation on how to get started with Credo can be found at https://credo.js.org/

## Features

See [Supported Features](https://credo.js.org/guides/features) on the Credo website for a full list of supported features.

- 🏃 **Platform agnostic** - out of the box support for Node.JS and React Native
- 🔒 **DIDComm and AIP** - Support for [DIDComm v1](https://hyperledger.github.io/aries-rfcs/latest/concepts/0005-didcomm/), and both v1 and v2 of the [Aries Interop Profile](https://github.com/hyperledger/aries-rfcs/blob/main/concepts/0302-aries-interop-profile/README.md).
- 🛂 **Extendable [DID](https://www.w3.org/TR/did-core/) resolver and registrar** - out of the box support for `did:web`, `did:webvh`, `did:key`, `did:jwk`, `did:peer`, `did:sov`, `did:indy`, `did:cheqd` and `did:hedera`.
- 🔑 **[OpenID4VC](https://openid.net/sg/openid4vc/)** - support for [OpenID for Verifiable Credential Issuance](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html), [OpenID for Verifiable Presentations](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html) and [Self-Issued OpenID Provider v2](https://openid.net/specs/openid-connect-self-issued-v2-1_0.html).
- 🪪 **Multiple credential formats** - [W3C Verifiable Credential Data Model v1.1](https://www.w3.org/TR/vc-data-model/), [SD-JWT VCs](https://www.ietf.org/archive/id/draft-ietf-oauth-sd-jwt-vc-03.html), and [AnonCreds](https://hyperledger.github.io/anoncreds-spec/).
- 🏢 **Multi-tenant** - Optional multi-tenant module for managing multiple tenants under a single agent.

### Packages

<table>
  <tr>
    <th><b>Package</b></th>
    <th><b>Version</b></th>
  </tr>
  <tr>
    <td>@credo-ts/core</td>
    <td>
      <a href="https://npmjs.com/package/@credo-ts/core">
        <img alt="@credo-ts/core version" src="https://img.shields.io/npm/v/@credo-ts/core"/>
      </a>
    </td>
  </tr>
  <tr>
    <td>@credo-ts/node</td>
    <td>
      <a href="https://npmjs.com/package/@credo-ts/node">
        <img alt="@credo-ts/node version" src="https://img.shields.io/npm/v/@credo-ts/node"/>
      </a>
    </td>
  </tr>
  <tr>
    <td>@credo-ts/react-native</td>
    <td>
      <a href="https://npmjs.com/package/@credo-ts/react-native">
        <img alt="@credo-ts/react-native version" src="https://img.shields.io/npm/v/@credo-ts/react-native"/>
      </a>
    </td>
  </tr>
  <tr>
    <td>@credo-ts/indy-vdr</td>
    <td>
      <a href="https://npmjs.com/package/@credo-ts/indy-vdr">
        <img alt="@credo-ts/indy-vdr version" src="https://img.shields.io/npm/v/@credo-ts/indy-vdr"/>
      </a>
    </td>
  </tr>
  <tr>
    <td>@credo-ts/cheqd</td>
    <td>
      <a href="https://npmjs.com/package/@credo-ts/cheqd">
        <img alt="@credo-ts/cheqd version" src="https://img.shields.io/npm/v/@credo-ts/cheqd"/>
      </a>
    </td>
  </tr>  
  <tr>
    <td>@credo-ts/askar</td>
    <td>
      <a href="https://npmjs.com/package/@credo-ts/askar">
        <img alt="@credo-ts/askar version" src="https://img.shields.io/npm/v/@credo-ts/askar"/>
      </a>
    </td>
  </tr>
  <tr>
    <td>@credo-ts/anoncreds</td>
    <td>
      <a href="https://npmjs.com/package/@credo-ts/anoncreds">
        <img alt="@credo-ts/anoncreds version" src="https://img.shields.io/npm/v/@credo-ts/anoncreds"/>
      </a>
    </td>
  </tr>
  <tr>
    <td>@credo-ts/openid4vc</td>
    <td>
      <a href="https://npmjs.com/package/@credo-ts/openid4vc">
        <img alt="@credo-ts/openid4vc version" src="https://img.shields.io/npm/v/@credo-ts/openid4vc"/>
      </a>
    </td>
  </tr>
   <tr>
    <td>@credo-ts/action-menu</td>
    <td>
      <a href="https://npmjs.com/package/@credo-ts/action-menu">
        <img alt="@credo-ts/action-menu version" src="https://img.shields.io/npm/v/@credo-ts/action-menu"/>
      </a>
    </td>
  </tr>
    <td>@credo-ts/question-answer</td>
    <td>
      <a href="https://npmjs.com/package/@credo-ts/question-answer">
        <img alt="@credo-ts/question-answer version" src="https://img.shields.io/npm/v/@credo-ts/question-answer"/>
      </a>
    </td>
  </tr>
  <tr>
    <td>@credo-ts/tenants</td>
    <td>
      <a href="https://npmjs.com/package/@credo-ts/tenants">
        <img alt="@credo-ts/tenants version" src="https://img.shields.io/npm/v/@credo-ts/tenants"/>
      </a>
    </td>
  </tr>
  <tr>
    <td>@credo-ts/drpc</td>
    <td>
      <a href="https://npmjs.com/package/@credo-ts/drpc">
        <img alt="@credo-ts/drpc version" src="https://img.shields.io/npm/v/@credo-ts/drpc"/>
      </a>
    </td>
  </tr>
  <tr>
    <td>@credo-ts/hedera</td>
    <td>
      <a href="https://npmjs.com/package/@credo-ts/hedera">
        <img alt="@credo-ts/hedera version" src="https://img.shields.io/npm/v/@credo-ts/hedera"/>
      </a>
    </td>
  </tr> 
  <tr>
    <td><s>@aries-framework/indy-sdk</s> (deprecated, unmaintained after 0.4.x)</td>
    <td>
      <a href="https://npmjs.com/package/@aries-framework/indy-sdk">
        <img alt="@aries-framework/indy-sdk version" src="https://img.shields.io/npm/v/@aries-framework/indy-sdk"/>
      </a>
    </td>
  </tr>
  <tr>
    <td><s>@aries-framework/anoncreds-rs</s> (deprecated and combined with <code>@credo-ts/anoncreds</code>)</td>
    <td>
      <a href="https://npmjs.com/package/@aries-framework/anoncreds-rs">
        <img alt="@aries-framework/anoncreds-rs version" src="https://img.shields.io/npm/v/@aries-framework/anoncreds-rs"/>
      </a>
    </td>
  </tr>
  <tr>
    <td><s>@credo-ts/openid4vc-client</s> (deprecated in favour of <code>@credo-ts/openid4vc</code>)</td>
    <td>
      <a href="https://npmjs.com/package/@credo-ts/openid4vc-client">
        <img alt="@credo-ts/openid4vc-client version" src="https://img.shields.io/npm/v/@credo-ts/openid4vc-client"/>
      </a>
    </td>
  </tr>
</table>

## Demo

To get to know the Credo issuance and verification flow, we built a demo to walk through it yourself together with agents Alice and Faber.

- OpenID4VC and SD-JWT VC demo in the [`/demo-openid`](/demo-openid) directory.
- DIDComm and AnonCreds demo in the [`/demo`](/demo) directory.

## Contributing

If you would like to contribute to the framework, please read the [Framework Developers README](/DEVREADME.md) and the [CONTRIBUTING](/CONTRIBUTING.md) guidelines. These documents will provide more information to get you started!

There are regular community working groups to discuss ongoing efforts within the framework, showcase items you've built with Credo, or ask questions. See [Meeting Information](https://github.com/openwallet-foundation/credo-ts/wiki/Meeting-Information) for up to date information on the meeting schedule. Everyone is welcome to join!

We welcome you to join our mailing list and Discord channel. See the [Wiki](https://github.com/openwallet-foundation/credo-ts/wiki/Communication) for up to date information.

## License

OpenWallet Foundation Credo is licensed under the [Apache License Version 2.0 (Apache-2.0)](/LICENSE).
