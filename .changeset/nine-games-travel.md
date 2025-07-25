---
"@credo-ts/indy-sdk-to-askar-migration": minor
"@credo-ts/question-answer": minor
"@credo-ts/react-native": minor
"@credo-ts/action-menu": minor
"@credo-ts/anoncreds": minor
"@credo-ts/openid4vc": minor
"@credo-ts/indy-vdr": minor
"@credo-ts/didcomm": minor
"@credo-ts/tenants": minor
"@credo-ts/askar": minor
"@credo-ts/cheqd": minor
"@credo-ts/core": minor
"@credo-ts/drpc": minor
"@credo-ts/node": minor
---

The wallet API has been completely rewritten to be more generic, support multiple backends at the same time, support generic encrypting and decryption, support symmetric keys, and enable backends that use key ids rather than the public key to identify a key. This has resulted in significant breaking changes, and all usages of the wallet api should be updated to use the new `agent.kms` APIs. In addition the wallet is not available anymore on the agentContext. If you used this, instead inject the KMS API using `agentContext.resolve(Kms.KeyManagementApi)`.
