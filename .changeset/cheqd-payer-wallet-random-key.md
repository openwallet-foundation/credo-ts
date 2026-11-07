---
'@credo-ts/cheqd': patch
---

Without a `cosmosPayerSeed`, the cosmos payer wallet is now created from a random key instead of a generated mnemonic. Deriving the mnemonic's seed with PBKDF2 failed on React Native, where `@credo-ts/react-native` adds only `crypto.subtle.digest`, so cheqd DIDs couldn't be resolved there. It also skips a PBKDF2 for each configured network when the agent starts.
