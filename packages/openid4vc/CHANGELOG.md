# Changelog

## 0.5.6

### Patch Changes

- 66e696d: Fix build issue causing error with importing packages in 0.5.5 release
- Updated dependencies [66e696d]
  - @credo-ts/core@0.5.6

## 0.5.5

### Patch Changes

- 482a630: - feat: allow serving dids from did record (#1856)
  - fix: set created at for anoncreds records (#1862)
  - feat: add goal to public api for credential and proof (#1867)
  - fix(oob): only reuse connection if enabled (#1868)
  - fix: issuer id query anoncreds w3c (#1870)
  - feat: sd-jwt issuance without holder binding (#1871)
  - chore: update oid4vci deps (#1873)
  - fix: query for qualified/unqualified forms in revocation notification (#1866)
  - fix: wrong schema id is stored for credentials (#1884)
  - fix: process credential or proof problem report message related to connectionless or out of band exchange (#1859)
  - fix: unqualified indy revRegDefId in migration (#1887)
  - feat: verify SD-JWT Token status list and SD-JWT VC fixes (#1872)
  - fix(anoncreds): combine creds into one proof (#1893)
  - fix: AnonCreds proof requests with unqualified dids (#1891)
  - fix: WebSocket priority in Message Pick Up V2 (#1888)
  - fix: anoncreds predicate only proof with unqualified dids (#1907)
  - feat: add pagination params to storage service (#1883)
  - feat: add message handler middleware and fallback (#1894)
- Updated dependencies [3239ef3]
- Updated dependencies [d548fa4]
- Updated dependencies [482a630]
  - @credo-ts/core@0.5.5

## [0.5.3](https://github.com/openwallet-foundation/credo-ts/compare/v0.5.2...v0.5.3) (2024-05-01)

**Note:** Version bump only for package @credo-ts/openid4vc

## [0.5.2](https://github.com/openwallet-foundation/credo-ts/compare/v0.5.1...v0.5.2) (2024-04-26)

### Bug Fixes

- access token can only be used for offer ([#1828](https://github.com/openwallet-foundation/credo-ts/issues/1828)) ([f54b90b](https://github.com/openwallet-foundation/credo-ts/commit/f54b90b0530b43a04df6299a39414a142d73276e))
- oid4vp can be used separate from idtoken ([#1827](https://github.com/openwallet-foundation/credo-ts/issues/1827)) ([ca383c2](https://github.com/openwallet-foundation/credo-ts/commit/ca383c284e2073992a1fd280fca99bee1c2e19f8))
- **openid4vc:** update verified state for more states ([#1831](https://github.com/openwallet-foundation/credo-ts/issues/1831)) ([958bf64](https://github.com/openwallet-foundation/credo-ts/commit/958bf647c086a2ca240e9ad140defc39b7f20f43))

### Features

- add disclosures so you know which fields are disclosed ([#1834](https://github.com/openwallet-foundation/credo-ts/issues/1834)) ([6ec43eb](https://github.com/openwallet-foundation/credo-ts/commit/6ec43eb1f539bd8d864d5bbd2ab35459809255ec))
- apply new version of SD JWT package ([#1787](https://github.com/openwallet-foundation/credo-ts/issues/1787)) ([b41e158](https://github.com/openwallet-foundation/credo-ts/commit/b41e158098773d2f59b5b5cfb82cc6be06a57acd))
- openid4vc issued state per credential ([#1829](https://github.com/openwallet-foundation/credo-ts/issues/1829)) ([229c621](https://github.com/openwallet-foundation/credo-ts/commit/229c62177c04060c7ca4c19dfd35bab328035067))

## [0.5.1](https://github.com/openwallet-foundation/credo-ts/compare/v0.5.0...v0.5.1) (2024-03-28)

### Bug Fixes

- **openid4vc:** several fixes and improvements ([#1795](https://github.com/openwallet-foundation/credo-ts/issues/1795)) ([b83c517](https://github.com/openwallet-foundation/credo-ts/commit/b83c5173070594448d92f801331b3a31c7ac8049))

# [0.5.0](https://github.com/openwallet-foundation/credo-ts/compare/v0.4.2...v0.5.0) (2024-03-13)

### Features

- anoncreds w3c migration ([#1744](https://github.com/openwallet-foundation/credo-ts/issues/1744)) ([d7c2bbb](https://github.com/openwallet-foundation/credo-ts/commit/d7c2bbb4fde57cdacbbf1ed40c6bd1423f7ab015))
- **openid4vc:** persistance and events ([#1793](https://github.com/openwallet-foundation/credo-ts/issues/1793)) ([f4c386a](https://github.com/openwallet-foundation/credo-ts/commit/f4c386a6ccf8adb829cad30b81d524e6ffddb029))
