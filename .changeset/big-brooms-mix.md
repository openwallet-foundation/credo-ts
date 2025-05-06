---
'@credo-ts/action-menu': patch
'@credo-ts/anoncreds': patch
'@credo-ts/askar': patch
'@credo-ts/bbs-signatures': patch
'@credo-ts/cheqd': patch
'@credo-ts/core': patch
'@credo-ts/drpc': patch
'@credo-ts/indy-sdk-to-askar-migration': patch
'@credo-ts/indy-vdr': patch
'@credo-ts/node': patch
'@credo-ts/openid4vc': patch
'@credo-ts/question-answer': patch
'@credo-ts/react-native': patch
'@credo-ts/tenants': patch
---

update the target to ES2020. Although this is technically a breaking change all the supported envrionments of Credo should support ES2020 and thus not cause issues. The update is required to include an important update for the cheqd SDK.
