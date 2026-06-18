---
"@credo-ts/core": patch
---

Rename anoncreds Data Integrity bridge APIs to the new W3C bridge namespace.

This change replaces the old Data Integrity-specific symbols and types with W3C bridge equivalents, including:

- `IAnonCredsDataIntegrityService` -> `IAnonCredsW3cBridgeService`
- `AnonCredsDataIntegrityServiceSymbol` -> `AnonCredsW3cBridgeServiceSymbol`
- `ANONCREDS_DATA_INTEGRITY_CRYPTOSUITE` -> `ANONCREDS_W3C_BRIDGE_CRYPTOSUITE`
- `DataIntegrityProof` model usage for anoncreds bridge payloads -> `AnonCredsW3cBridgeProof`
- `dataIntegrityCryptosuites` -> `anoncredsW3cBridgeCryptosuites`

Also, generic JSON-LD verification now rejects W3C bridge proofs with `cryptosuite: "anoncreds-2023"` and requires verification through the anoncreds W3C bridge path.
