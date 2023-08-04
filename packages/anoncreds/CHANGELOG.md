# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.4.0](https://github.com/hyperledger/aries-framework-javascript/compare/v0.3.3...v0.4.0) (2023-06-03)

### Bug Fixes

- add reflect-metadata ([#1409](https://github.com/hyperledger/aries-framework-javascript/issues/1409)) ([692defa](https://github.com/hyperledger/aries-framework-javascript/commit/692defa45ffcb4f36b0fa36970c4dc27aa75317c))
- **anoncreds:** Buffer not imported from core ([#1367](https://github.com/hyperledger/aries-framework-javascript/issues/1367)) ([c133538](https://github.com/hyperledger/aries-framework-javascript/commit/c133538356471a6a0887322a3f6245aa5193e7e4))
- **anoncreds:** include prover_did for legacy indy ([#1342](https://github.com/hyperledger/aries-framework-javascript/issues/1342)) ([d38ecb1](https://github.com/hyperledger/aries-framework-javascript/commit/d38ecb14cb58f1eb78e01c91699bb990d805dc08))
- **anoncreds:** make revocation status list inline with the spec ([#1421](https://github.com/hyperledger/aries-framework-javascript/issues/1421)) ([644e860](https://github.com/hyperledger/aries-framework-javascript/commit/644e860a05f40166e26c497a2e8619c9a38df11d))
- **askar:** anoncrypt messages unpacking ([#1332](https://github.com/hyperledger/aries-framework-javascript/issues/1332)) ([1c6aeae](https://github.com/hyperledger/aries-framework-javascript/commit/1c6aeae31ac57e83f4059f3dba35ccb1ca36926e))
- incorrect type for anoncreds registration ([#1396](https://github.com/hyperledger/aries-framework-javascript/issues/1396)) ([9f0f8f2](https://github.com/hyperledger/aries-framework-javascript/commit/9f0f8f21e7436c0a422d8c3a42a4cb601bcf7c77))
- issuance with unqualified identifiers ([#1431](https://github.com/hyperledger/aries-framework-javascript/issues/1431)) ([de90caf](https://github.com/hyperledger/aries-framework-javascript/commit/de90cafb8d12b7a940f881184cd745c4b5043cbc))
- migration of link secret ([#1444](https://github.com/hyperledger/aries-framework-javascript/issues/1444)) ([9a43afe](https://github.com/hyperledger/aries-framework-javascript/commit/9a43afec7ea72a6fa8c6133f0fad05d8a3d2a595))
- various anoncreds revocation fixes ([#1416](https://github.com/hyperledger/aries-framework-javascript/issues/1416)) ([d9cfc7d](https://github.com/hyperledger/aries-framework-javascript/commit/d9cfc7df6679d2008d66070a6c8a818440d066ab))

- feat!: add data, cache and temp dirs to FileSystem (#1306) ([ff5596d](https://github.com/hyperledger/aries-framework-javascript/commit/ff5596d0631e93746494c017797d0191b6bdb0b1)), closes [#1306](https://github.com/hyperledger/aries-framework-javascript/issues/1306)

### Features

- 0.4.0 migration script ([#1392](https://github.com/hyperledger/aries-framework-javascript/issues/1392)) ([bc5455f](https://github.com/hyperledger/aries-framework-javascript/commit/bc5455f7b42612a2b85e504bc6ddd36283a42bfa))
- add anoncreds-rs package ([#1275](https://github.com/hyperledger/aries-framework-javascript/issues/1275)) ([efe0271](https://github.com/hyperledger/aries-framework-javascript/commit/efe0271198f21f1307df0f934c380f7a5c720b06))
- **anoncreds:** add anoncreds API ([#1232](https://github.com/hyperledger/aries-framework-javascript/issues/1232)) ([3a4c5ec](https://github.com/hyperledger/aries-framework-javascript/commit/3a4c5ecd940e49d4d192eef1d41f2aaedb34d85a))
- **anoncreds:** add AnonCreds format services ([#1385](https://github.com/hyperledger/aries-framework-javascript/issues/1385)) ([5f71dc2](https://github.com/hyperledger/aries-framework-javascript/commit/5f71dc2b403f6cb0fc9bb13f35051d377c2d1250))
- **anoncreds:** add getCredential(s) methods ([#1386](https://github.com/hyperledger/aries-framework-javascript/issues/1386)) ([2efc009](https://github.com/hyperledger/aries-framework-javascript/commit/2efc0097138585391940fbb2eb504e50df57ec87))
- **anoncreds:** add legacy indy credential format ([#1220](https://github.com/hyperledger/aries-framework-javascript/issues/1220)) ([13f3740](https://github.com/hyperledger/aries-framework-javascript/commit/13f374079262168f90ec7de7c3393beb9651295c))
- **anoncreds:** legacy indy proof format service ([#1283](https://github.com/hyperledger/aries-framework-javascript/issues/1283)) ([c72fd74](https://github.com/hyperledger/aries-framework-javascript/commit/c72fd7416f2c1bc0497a84036e16adfa80585e49))
- **anoncreds:** store method name in records ([#1387](https://github.com/hyperledger/aries-framework-javascript/issues/1387)) ([47636b4](https://github.com/hyperledger/aries-framework-javascript/commit/47636b4a08ffbfa9a3f2a5a3c5aebda44f7d16c8))
- **anoncreds:** support credential attribute value and marker ([#1369](https://github.com/hyperledger/aries-framework-javascript/issues/1369)) ([5559996](https://github.com/hyperledger/aries-framework-javascript/commit/555999686a831e6988564fd5c9c937fc1023f567))
- **anoncreds:** use legacy prover did ([#1374](https://github.com/hyperledger/aries-framework-javascript/issues/1374)) ([c17013c](https://github.com/hyperledger/aries-framework-javascript/commit/c17013c808a278d624210ce9e4333860cd78fc19))
- default return route ([#1327](https://github.com/hyperledger/aries-framework-javascript/issues/1327)) ([dbfebb4](https://github.com/hyperledger/aries-framework-javascript/commit/dbfebb4720da731dbe11efdccdd061d1da3d1323))
- **indy-vdr:** schema + credential definition endorsement ([#1451](https://github.com/hyperledger/aries-framework-javascript/issues/1451)) ([25b981b](https://github.com/hyperledger/aries-framework-javascript/commit/25b981b6e23d02409e90dabdccdccc8904d4e357))
- outbound message send via session ([#1335](https://github.com/hyperledger/aries-framework-javascript/issues/1335)) ([582c711](https://github.com/hyperledger/aries-framework-javascript/commit/582c711728db12b7d38a0be2e9fa78dbf31b34c6))

### BREAKING CHANGES

- Agent-produced files will now be divided in different system paths depending on their nature: data, temp and cache. Previously, they were located at a single location, defaulting to a temporary directory.

If you specified a custom path in `FileSystem` object constructor, you now must provide an object containing `baseDataPath`, `baseTempPath` and `baseCachePath`. They can point to the same path, although it's recommended to specify different path to avoid future file clashes.
