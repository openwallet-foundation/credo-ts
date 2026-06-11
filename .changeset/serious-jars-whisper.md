---
"@credo-ts/core": patch
---

Rename anoncreds Data Integrity VC1 bridge APIs to the new VC1 bridge namespace.

This change replaces the old Data Integrity-specific symbols and types with VC1 bridge equivalents, including:

- `IAnonCredsDataIntegrityService` -> `IAnonCredsVc1BridgeService`
- `AnonCredsDataIntegrityServiceSymbol` -> `AnonCredsVc1BridgeServiceSymbol`
- `ANONCREDS_DATA_INTEGRITY_CRYPTOSUITE` -> `ANONCREDS_VC1_BRIDGE_CRYPTOSUITE`
- `DataIntegrityProof` model usage for anoncreds bridge payloads -> `AnonCredsVc1BridgeProof`
- `dataIntegrityCryptosuites` -> `anoncredsVc1BridgeCryptosuites`

Also, generic JSON-LD verification now rejects VC1 bridge proofs with `cryptosuite: "anoncreds-2023"` and requires verification through the anoncreds VC1 bridge path.
