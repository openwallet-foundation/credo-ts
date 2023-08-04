# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.4.0](https://github.com/hyperledger/aries-framework-javascript/compare/v0.3.3...v0.4.0) (2023-06-03)

### Bug Fixes

- **anoncreds:** include prover_did for legacy indy ([#1342](https://github.com/hyperledger/aries-framework-javascript/issues/1342)) ([d38ecb1](https://github.com/hyperledger/aries-framework-javascript/commit/d38ecb14cb58f1eb78e01c91699bb990d805dc08))
- **anoncreds:** make revocation status list inline with the spec ([#1421](https://github.com/hyperledger/aries-framework-javascript/issues/1421)) ([644e860](https://github.com/hyperledger/aries-framework-javascript/commit/644e860a05f40166e26c497a2e8619c9a38df11d))
- did cache key not being set correctly ([#1394](https://github.com/hyperledger/aries-framework-javascript/issues/1394)) ([1125e81](https://github.com/hyperledger/aries-framework-javascript/commit/1125e81962ffa752bf40fa8f7f4226e186f22013))
- expose indy pool configs and action menu messages ([#1333](https://github.com/hyperledger/aries-framework-javascript/issues/1333)) ([518e5e4](https://github.com/hyperledger/aries-framework-javascript/commit/518e5e4dfb59f9c0457bfd233409e9f4b3c429ee))
- **indy-sdk:** import from core ([#1346](https://github.com/hyperledger/aries-framework-javascript/issues/1346)) ([254f661](https://github.com/hyperledger/aries-framework-javascript/commit/254f661c2e925b62dd07c3565099f9e226bd2b41))
- issuance with unqualified identifiers ([#1431](https://github.com/hyperledger/aries-framework-javascript/issues/1431)) ([de90caf](https://github.com/hyperledger/aries-framework-javascript/commit/de90cafb8d12b7a940f881184cd745c4b5043cbc))
- reference to indyLedgers in IndyXXXNotConfiguredError ([#1397](https://github.com/hyperledger/aries-framework-javascript/issues/1397)) ([d6e2ea2](https://github.com/hyperledger/aries-framework-javascript/commit/d6e2ea2194a4860265fe299ef8ee4cb4799ab1a6))
- remove named capture groups ([#1378](https://github.com/hyperledger/aries-framework-javascript/issues/1378)) ([a4204ef](https://github.com/hyperledger/aries-framework-javascript/commit/a4204ef2db769de53d12f0d881d2c4422545c390))
- seed and private key validation and return type in registrars ([#1324](https://github.com/hyperledger/aries-framework-javascript/issues/1324)) ([c0e5339](https://github.com/hyperledger/aries-framework-javascript/commit/c0e5339edfa32df92f23fb9c920796b4b59adf52))
- various anoncreds revocation fixes ([#1416](https://github.com/hyperledger/aries-framework-javascript/issues/1416)) ([d9cfc7d](https://github.com/hyperledger/aries-framework-javascript/commit/d9cfc7df6679d2008d66070a6c8a818440d066ab))

- feat!: add data, cache and temp dirs to FileSystem (#1306) ([ff5596d](https://github.com/hyperledger/aries-framework-javascript/commit/ff5596d0631e93746494c017797d0191b6bdb0b1)), closes [#1306](https://github.com/hyperledger/aries-framework-javascript/issues/1306)

### Features

- 0.4.0 migration script ([#1392](https://github.com/hyperledger/aries-framework-javascript/issues/1392)) ([bc5455f](https://github.com/hyperledger/aries-framework-javascript/commit/bc5455f7b42612a2b85e504bc6ddd36283a42bfa))
- add anoncreds-rs package ([#1275](https://github.com/hyperledger/aries-framework-javascript/issues/1275)) ([efe0271](https://github.com/hyperledger/aries-framework-javascript/commit/efe0271198f21f1307df0f934c380f7a5c720b06))
- add fetch indy schema method ([#1290](https://github.com/hyperledger/aries-framework-javascript/issues/1290)) ([1d782f5](https://github.com/hyperledger/aries-framework-javascript/commit/1d782f54bbb4abfeb6b6db6cd4f7164501b6c3d9))
- **anoncreds:** add anoncreds API ([#1232](https://github.com/hyperledger/aries-framework-javascript/issues/1232)) ([3a4c5ec](https://github.com/hyperledger/aries-framework-javascript/commit/3a4c5ecd940e49d4d192eef1d41f2aaedb34d85a))
- **anoncreds:** add getCredential(s) methods ([#1386](https://github.com/hyperledger/aries-framework-javascript/issues/1386)) ([2efc009](https://github.com/hyperledger/aries-framework-javascript/commit/2efc0097138585391940fbb2eb504e50df57ec87))
- **anoncreds:** add legacy indy credential format ([#1220](https://github.com/hyperledger/aries-framework-javascript/issues/1220)) ([13f3740](https://github.com/hyperledger/aries-framework-javascript/commit/13f374079262168f90ec7de7c3393beb9651295c))
- **anoncreds:** legacy indy proof format service ([#1283](https://github.com/hyperledger/aries-framework-javascript/issues/1283)) ([c72fd74](https://github.com/hyperledger/aries-framework-javascript/commit/c72fd7416f2c1bc0497a84036e16adfa80585e49))
- **anoncreds:** store method name in records ([#1387](https://github.com/hyperledger/aries-framework-javascript/issues/1387)) ([47636b4](https://github.com/hyperledger/aries-framework-javascript/commit/47636b4a08ffbfa9a3f2a5a3c5aebda44f7d16c8))
- **anoncreds:** use legacy prover did ([#1374](https://github.com/hyperledger/aries-framework-javascript/issues/1374)) ([c17013c](https://github.com/hyperledger/aries-framework-javascript/commit/c17013c808a278d624210ce9e4333860cd78fc19))
- **cache:** add caching interface ([#1229](https://github.com/hyperledger/aries-framework-javascript/issues/1229)) ([25b2bcf](https://github.com/hyperledger/aries-framework-javascript/commit/25b2bcf81648100b572784e4489a288cc9da0557))
- **indy-vdr:** add IndyVdrAnonCredsRegistry ([#1270](https://github.com/hyperledger/aries-framework-javascript/issues/1270)) ([d056316](https://github.com/hyperledger/aries-framework-javascript/commit/d056316712b5ee5c42a159816b5dda0b05ad84a8))
- **openid4vc:** jwt format and more crypto ([#1472](https://github.com/hyperledger/aries-framework-javascript/issues/1472)) ([bd4932d](https://github.com/hyperledger/aries-framework-javascript/commit/bd4932d34f7314a6d49097b6460c7570e1ebc7a8))

### BREAKING CHANGES

- Agent-produced files will now be divided in different system paths depending on their nature: data, temp and cache. Previously, they were located at a single location, defaulting to a temporary directory.

If you specified a custom path in `FileSystem` object constructor, you now must provide an object containing `baseDataPath`, `baseTempPath` and `baseCachePath`. They can point to the same path, although it's recommended to specify different path to avoid future file clashes.
