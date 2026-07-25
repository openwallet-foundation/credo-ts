---
"@credo-ts/core": patch
---

refactor(vc): rename anoncreds Data Integrity bridge APIs to W3C credential namespace. Replaces Data Integrity-specific symbols and types (`IAnonCredsDataIntegrityService`, `AnonCredsDataIntegrityServiceSymbol`, `ANONCREDS_DATA_INTEGRITY_CRYPTOSUITE`, `DataIntegrityProof`, `dataIntegrityCryptosuites`) with W3C credential equivalents. Generic JSON-LD verification now rejects anoncreds-2023 proofs and requires anoncreds W3C credential path. Introduces `shouldSignUsingAnonCredsW3cService()` and `shouldVerifyWithAnonCredsW3cService()` to clarify service responsibilities.
