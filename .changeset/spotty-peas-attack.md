---
"@credo-ts/askar": minor
"@credo-ts/core": minor
---

The wallet config has been removed from the main agent config, to allow for more flexibility. Instead, each module can now define their own config for the storage and kms. For askar there is a new `store` property which must be provided on the askar module config where you can set the wallet id and key. It is also possible to disable the kms or storage for askar using `enableKms` and `enableStorage`.
