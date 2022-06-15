# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.0.1](https://github.com/hyperledger/aries-framework-javascript/compare/v0.2.0-alpha.124...v1.0.1) (2022-06-15)

**Note:** Version bump only for package @aries-framework/core

# 0.1.0 (2021-12-23)

### Bug Fixes

- add details to connection signing error ([#484](https://github.com/hyperledger/aries-framework-javascript/issues/484)) ([e24eafd](https://github.com/hyperledger/aries-framework-javascript/commit/e24eafd83f53a9833b95bc3a4587cf825ee5d975))
- add option check to attribute constructor ([#450](https://github.com/hyperledger/aries-framework-javascript/issues/450)) ([8aad3e9](https://github.com/hyperledger/aries-framework-javascript/commit/8aad3e9f16c249e9f9291388ec8efc9bf27213c8))
- added ariesframeworkerror to httpoutboundtransport ([#438](https://github.com/hyperledger/aries-framework-javascript/issues/438)) ([ee1a229](https://github.com/hyperledger/aries-framework-javascript/commit/ee1a229f8fc21739bca05c516a7b561f53726b91))
- alter mediation recipient websocket transport priority ([#434](https://github.com/hyperledger/aries-framework-javascript/issues/434)) ([52c7897](https://github.com/hyperledger/aries-framework-javascript/commit/52c789724c731340daa8528b7d7b4b7fdcb40032))
- **core:** convert legacy prefix for inner msgs ([#479](https://github.com/hyperledger/aries-framework-javascript/issues/479)) ([a2b655a](https://github.com/hyperledger/aries-framework-javascript/commit/a2b655ac79bf0c7460671c8d31e92828e6f5ccf0))
- **core:** do not throw error on timeout in http ([#512](https://github.com/hyperledger/aries-framework-javascript/issues/512)) ([4e73a7b](https://github.com/hyperledger/aries-framework-javascript/commit/4e73a7b0d9224bc102b396d821a8ea502a9a509d))
- **core:** do not use did-communication service ([#402](https://github.com/hyperledger/aries-framework-javascript/issues/402)) ([cdf2edd](https://github.com/hyperledger/aries-framework-javascript/commit/cdf2eddc61e12f7ecd5a29e260eef82394d2e467))
- **core:** export AgentMessage ([#480](https://github.com/hyperledger/aries-framework-javascript/issues/480)) ([af39ad5](https://github.com/hyperledger/aries-framework-javascript/commit/af39ad535320133ee38fc592309f42670a8517a1))
- **core:** expose record metadata types ([#556](https://github.com/hyperledger/aries-framework-javascript/issues/556)) ([68995d7](https://github.com/hyperledger/aries-framework-javascript/commit/68995d7e2b049ff6496723d8a895e07b72fe72fb))
- **core:** fix empty error log in console logger ([#524](https://github.com/hyperledger/aries-framework-javascript/issues/524)) ([7d9c541](https://github.com/hyperledger/aries-framework-javascript/commit/7d9c541de22fb2644455cf1949184abf3d8e528c))
- **core:** improve wallet not initialized error ([#513](https://github.com/hyperledger/aries-framework-javascript/issues/513)) ([b948d4c](https://github.com/hyperledger/aries-framework-javascript/commit/b948d4c83b4eb0ab0594ae2117c0bb05b0955b21))
- **core:** improved present-proof tests ([#482](https://github.com/hyperledger/aries-framework-javascript/issues/482)) ([41d9282](https://github.com/hyperledger/aries-framework-javascript/commit/41d9282ca561ca823b28f179d409c70a22d95e9b))
- **core:** log errors if message is undeliverable ([#528](https://github.com/hyperledger/aries-framework-javascript/issues/528)) ([20b586d](https://github.com/hyperledger/aries-framework-javascript/commit/20b586db6eb9f92cce16d87d0dcfa4919f27ffa8))
- **core:** remove isPositive validation decorators ([#477](https://github.com/hyperledger/aries-framework-javascript/issues/477)) ([e316e04](https://github.com/hyperledger/aries-framework-javascript/commit/e316e047b3e5aeefb929a5c47ad65d8edd4caba5))
- **core:** remove unused url import ([#466](https://github.com/hyperledger/aries-framework-javascript/issues/466)) ([0f1323f](https://github.com/hyperledger/aries-framework-javascript/commit/0f1323f5bccc2dc3b67426525b161d7e578bb961))
- **core:** requested predicates transform type ([#393](https://github.com/hyperledger/aries-framework-javascript/issues/393)) ([69684bc](https://github.com/hyperledger/aries-framework-javascript/commit/69684bc48a4002483662a211ec1ddd289dbaf59b))
- **core:** send messages now takes a connection id ([#491](https://github.com/hyperledger/aries-framework-javascript/issues/491)) ([ed9db11](https://github.com/hyperledger/aries-framework-javascript/commit/ed9db11592b4948a1d313dbeb074e15d59503d82))
- **core:** using query-string to parse URLs ([#457](https://github.com/hyperledger/aries-framework-javascript/issues/457)) ([78e5057](https://github.com/hyperledger/aries-framework-javascript/commit/78e505750557f296cc72ef19c0edd8db8e1eaa7d))
- date parsing ([#426](https://github.com/hyperledger/aries-framework-javascript/issues/426)) ([2d31b87](https://github.com/hyperledger/aries-framework-javascript/commit/2d31b87e99d04136f57cb457e2c67397ad65cc62))
- export indy pool config ([#504](https://github.com/hyperledger/aries-framework-javascript/issues/504)) ([b1e2b8c](https://github.com/hyperledger/aries-framework-javascript/commit/b1e2b8c54e909927e5afa8b8212e0c8e156b97f7))
- include error when message cannot be handled ([#533](https://github.com/hyperledger/aries-framework-javascript/issues/533)) ([febfb05](https://github.com/hyperledger/aries-framework-javascript/commit/febfb05330c097aa918087ec3853a247d6a31b7c))
- incorrect recip key with multi routing keys ([#446](https://github.com/hyperledger/aries-framework-javascript/issues/446)) ([db76823](https://github.com/hyperledger/aries-framework-javascript/commit/db76823400cfecc531575584ef7210af0c3b3e5c))
- make records serializable ([#448](https://github.com/hyperledger/aries-framework-javascript/issues/448)) ([7e2946e](https://github.com/hyperledger/aries-framework-javascript/commit/7e2946eaa9e35083f3aa70c26c732a972f6eb12f))
- mediator transports ([#419](https://github.com/hyperledger/aries-framework-javascript/issues/419)) ([87bc589](https://github.com/hyperledger/aries-framework-javascript/commit/87bc589695505de21294a1373afcf874fe8d22f6))
- mediator updates ([#432](https://github.com/hyperledger/aries-framework-javascript/issues/432)) ([163cda1](https://github.com/hyperledger/aries-framework-javascript/commit/163cda19ba8437894a48c9bc948528ea0486ccdf))
- proof configurable on proofRecord ([#397](https://github.com/hyperledger/aries-framework-javascript/issues/397)) ([8e83c03](https://github.com/hyperledger/aries-framework-javascript/commit/8e83c037e1d59c670cfd4a8a575d4459999a64f8))
- removed check for senderkey for connectionless exchange ([#555](https://github.com/hyperledger/aries-framework-javascript/issues/555)) ([ba3f17e](https://github.com/hyperledger/aries-framework-javascript/commit/ba3f17e073b28ee5f16031f0346de0b71119e6f3))
- support mediation for connectionless exchange ([#577](https://github.com/hyperledger/aries-framework-javascript/issues/577)) ([3dadfc7](https://github.com/hyperledger/aries-framework-javascript/commit/3dadfc7a202b3642e93e39cd79c9fd98a3dc4de2))
- their did doc not ours ([#436](https://github.com/hyperledger/aries-framework-javascript/issues/436)) ([0226609](https://github.com/hyperledger/aries-framework-javascript/commit/0226609a279303f5e8d09a2c01e54ff97cf61839))

- fix(core)!: Improved typing on metadata api (#585) ([4ab8d73](https://github.com/hyperledger/aries-framework-javascript/commit/4ab8d73e5fc866a91085f95f973022846ed431fb)), closes [#585](https://github.com/hyperledger/aries-framework-javascript/issues/585)
- fix(core)!: update class transformer library (#547) ([dee03e3](https://github.com/hyperledger/aries-framework-javascript/commit/dee03e38d2732ba0bd38eeacca6ad58b191e87f8)), closes [#547](https://github.com/hyperledger/aries-framework-javascript/issues/547)
- fix(core)!: prefixed internal metadata with \_internal/ (#535) ([aa1b320](https://github.com/hyperledger/aries-framework-javascript/commit/aa1b3206027fdb71e6aaa4c6491f8ba84dca7b9a)), closes [#535](https://github.com/hyperledger/aries-framework-javascript/issues/535)
- feat(core)!: metadata on records (#505) ([c92393a](https://github.com/hyperledger/aries-framework-javascript/commit/c92393a8b5d8abd38d274c605cd5c3f97f96cee9)), closes [#505](https://github.com/hyperledger/aries-framework-javascript/issues/505)
- fix(core)!: do not request ping res for connection (#527) ([3db5519](https://github.com/hyperledger/aries-framework-javascript/commit/3db5519f0d9f49b71b647ca86be3b336399459cb)), closes [#527](https://github.com/hyperledger/aries-framework-javascript/issues/527)
- refactor(core)!: simplify get creds for proof api (#523) ([ba9698d](https://github.com/hyperledger/aries-framework-javascript/commit/ba9698de2606e5c78f018dc5e5253aeb1f5fc616)), closes [#523](https://github.com/hyperledger/aries-framework-javascript/issues/523)
- fix(core)!: improve proof request validation (#525) ([1b4d8d6](https://github.com/hyperledger/aries-framework-javascript/commit/1b4d8d6b6c06821a2a981fffb6c47f728cac803e)), closes [#525](https://github.com/hyperledger/aries-framework-javascript/issues/525)
- feat(core)!: added basic message sent event (#507) ([d2c04c3](https://github.com/hyperledger/aries-framework-javascript/commit/d2c04c36c00d772943530bd599dbe56f3e1fb17d)), closes [#507](https://github.com/hyperledger/aries-framework-javascript/issues/507)

### Features

- add delete methods to services and modules ([#447](https://github.com/hyperledger/aries-framework-javascript/issues/447)) ([e7ed602](https://github.com/hyperledger/aries-framework-javascript/commit/e7ed6027d2aa9be7f64d5968c4338e63e56657fb))
- add from record method to cred preview ([#428](https://github.com/hyperledger/aries-framework-javascript/issues/428)) ([895f7d0](https://github.com/hyperledger/aries-framework-javascript/commit/895f7d084287f99221c9492a25fed58191868edd))
- add multiple inbound transports ([#433](https://github.com/hyperledger/aries-framework-javascript/issues/433)) ([56cb9f2](https://github.com/hyperledger/aries-framework-javascript/commit/56cb9f2202deb83b3c133905f21651bfefcb63f7))
- add problem report protocol ([#560](https://github.com/hyperledger/aries-framework-javascript/issues/560)) ([baee5db](https://github.com/hyperledger/aries-framework-javascript/commit/baee5db29f3d545c16a651c80392ddcbbca6bf0e))
- add toJson method to BaseRecord ([#455](https://github.com/hyperledger/aries-framework-javascript/issues/455)) ([f3790c9](https://github.com/hyperledger/aries-framework-javascript/commit/f3790c97c4d9a0aaec9abdce417ecd5429c6026f))
- added decline credential offer method ([#416](https://github.com/hyperledger/aries-framework-javascript/issues/416)) ([d9ac141](https://github.com/hyperledger/aries-framework-javascript/commit/d9ac141122f1d4902f91f9537e6526796fef1e01))
- added declined proof state and decline method for presentations ([e5aedd0](https://github.com/hyperledger/aries-framework-javascript/commit/e5aedd02737d3764871c6b5d4ae61a3a33ed8398))
- allow to use legacy did sov prefix ([#442](https://github.com/hyperledger/aries-framework-javascript/issues/442)) ([c41526f](https://github.com/hyperledger/aries-framework-javascript/commit/c41526fb57a7e2e89e923b95ede43f890a6cbcbb))
- auto accept proofs ([#367](https://github.com/hyperledger/aries-framework-javascript/issues/367)) ([735d578](https://github.com/hyperledger/aries-framework-javascript/commit/735d578f72fc5f3bfcbcf40d27394bd013e7cf4f))
- break out indy wallet, better indy handling ([#396](https://github.com/hyperledger/aries-framework-javascript/issues/396)) ([9f1a4a7](https://github.com/hyperledger/aries-framework-javascript/commit/9f1a4a754a61573ce3fee78d52615363c7e25d58))
- **core:** add discover features protocol ([#390](https://github.com/hyperledger/aries-framework-javascript/issues/390)) ([3347424](https://github.com/hyperledger/aries-framework-javascript/commit/3347424326cd15e8bf2544a8af53b2fa57b1dbb8))
- **core:** add support for multi use inviations ([#460](https://github.com/hyperledger/aries-framework-javascript/issues/460)) ([540ad7b](https://github.com/hyperledger/aries-framework-javascript/commit/540ad7be2133ee6609c2336b22b726270db98d6c))
- **core:** connection-less issuance and verification ([#359](https://github.com/hyperledger/aries-framework-javascript/issues/359)) ([fb46ade](https://github.com/hyperledger/aries-framework-javascript/commit/fb46ade4bc2dd4f3b63d4194bb170d2f329562b7))
- **core:** d_m invitation parameter and invitation image ([#456](https://github.com/hyperledger/aries-framework-javascript/issues/456)) ([f92c322](https://github.com/hyperledger/aries-framework-javascript/commit/f92c322b97be4a4867a82c3a35159d6068951f0b))
- **core:** ledger module registerPublicDid implementation ([#398](https://github.com/hyperledger/aries-framework-javascript/issues/398)) ([5f2d512](https://github.com/hyperledger/aries-framework-javascript/commit/5f2d5126baed2ff58268c38755c2dbe75a654947))
- **core:** store mediator id in connection record ([#503](https://github.com/hyperledger/aries-framework-javascript/issues/503)) ([da51f2e](https://github.com/hyperledger/aries-framework-javascript/commit/da51f2e8337f5774d23e9aeae0459bd7355a3760))
- **core:** support image url in invitations ([#463](https://github.com/hyperledger/aries-framework-javascript/issues/463)) ([9fda24e](https://github.com/hyperledger/aries-framework-javascript/commit/9fda24ecf55fdfeba74211447e9fadfdcbf57385))
- **core:** support multiple indy ledgers ([#474](https://github.com/hyperledger/aries-framework-javascript/issues/474)) ([47149bc](https://github.com/hyperledger/aries-framework-javascript/commit/47149bc5742456f4f0b75e0944ce276972e645b8))
- **core:** update agent label and imageUrl plus per connection label and imageUrl ([#516](https://github.com/hyperledger/aries-framework-javascript/issues/516)) ([5e9a641](https://github.com/hyperledger/aries-framework-javascript/commit/5e9a64130c02c8a5fdf11f0e25d0c23929a33a4f))
- **core:** validate outbound messages ([#526](https://github.com/hyperledger/aries-framework-javascript/issues/526)) ([9c3910f](https://github.com/hyperledger/aries-framework-javascript/commit/9c3910f1e67200b71bb4888c6fee62942afaff20))
- expose wallet API ([#566](https://github.com/hyperledger/aries-framework-javascript/issues/566)) ([4027fc9](https://github.com/hyperledger/aries-framework-javascript/commit/4027fc975d7e4118892f43cb8c6a0eea412eaad4))
- generic attachment handler ([#578](https://github.com/hyperledger/aries-framework-javascript/issues/578)) ([4d7d3c1](https://github.com/hyperledger/aries-framework-javascript/commit/4d7d3c1502d5eafa2b884a4a84934e072fe70ea6))
- **node:** add http and ws inbound transport ([#392](https://github.com/hyperledger/aries-framework-javascript/issues/392)) ([34a6ff2](https://github.com/hyperledger/aries-framework-javascript/commit/34a6ff2699197b9d525422a0a405e241582a476c))

### BREAKING CHANGES

- removed the getAll() function.
- The agent’s `shutdown` method does not delete the wallet anymore. If you want to delete the wallet, you can do it via exposed wallet API.
- class-transformer released a breaking change in a patch version, causing AFJ to break. I updated to the newer version and pinned the version exactly as this is the second time this has happened now.

Signed-off-by: Timo Glastra <timo@animo.id>

- internal metadata is now prefixed with \_internal to avoid clashing and accidental overwriting of internal data.

- fix(core): added \_internal/ prefix on metadata

Signed-off-by: Berend Sliedrecht <berend@animo.id>

- credentialRecord.credentialMetadata has been replaced by credentialRecord.metadata.

Signed-off-by: Berend Sliedrecht <berend@animo.id>

- a trust ping response will not be requested anymore after completing a connection. This is not required, and also non-standard behaviour. It was also causing some tests to be flaky as response messages were stil being sent after one of the agents had already shut down.

Signed-off-by: Timo Glastra <timo@animo.id>

- The `ProofsModule.getRequestedCredentialsForProofRequest` expected some low level message objects as input. This is not in line with the public API of the rest of the framework and has been simplified to only require a proof record id and optionally a boolean whether the retrieved credentials should be filtered based on the proof proposal (if available).

Signed-off-by: Timo Glastra <timo@animo.id>

- Proof request requestedAttributes and requestedPredicates are now a map instead of record. This is needed to have proper validation using class-validator.

Signed-off-by: Timo Glastra <timo@animo.id>

- `BasicMessageReceivedEvent` has been replaced by the more general `BasicMessageStateChanged` event which triggers when a basic message is received or sent.

Signed-off-by: NeilSMyers <mmyersneil@gmail.com>
