---
'@credo-ts/cheqd': patch
---

Resolving cheqd DIDs and resources no longer needs the cosmos payer wallet. The wallet is now created on the first ledger write, so a missing or failing `cosmosPayerSeed` doesn't block resolution. This fixes resolution on React Native, where deriving a wallet from a generated mnemonic failed. Ledger writes without a `cosmosPayerSeed` now fail with an error instead of using an unfunded generated wallet. On React Native, a mnemonic `cosmosPayerSeed` needs a full WebCrypto implementation such as `react-native-quick-crypto`.

`CheqdLedgerService.disconnect()` now disconnects instead of creating the SDK.
