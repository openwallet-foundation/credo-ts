---
'@credo-ts/hedera': patch
---

The Hedera AnonCreds registry now returns revocation status list timestamps in seconds, as AnonCreds requires, instead of the milliseconds used by the Hedera SDK. This fixes creating and verifying proofs with non-revocation for Hedera credentials, which failed with `Revocation status list ... not found in revocation status lists`. This applies to `getRevocationStatusList` and to the results of `registerRevocationStatusList` / `updateRevocationStatusList`. If you converted these timestamps from milliseconds yourself, remove that conversion.
