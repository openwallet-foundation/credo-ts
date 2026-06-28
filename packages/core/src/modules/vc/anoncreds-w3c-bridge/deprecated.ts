/**
 * Temporary compatibility aliases for the AnonCreds W3C bridge rename.
 *
 * Major-version cleanup checklist (separate from DataIntegrity namespace):
 * 1. Delete this file:
 *    - packages/core/src/modules/vc/anoncreds-w3c-bridge/deprecated.ts
 * 2. Stop exporting this file from the bridge barrel:
 *    - packages/core/src/modules/vc/anoncreds-w3c-bridge/index.ts
 * 3. Remove @deprecated getters:
 *    - packages/core/src/modules/vc/linked-data-proofs/models/W3cJsonLdVerifiableCredential.ts
 *      (dataIntegrityCryptosuites)
 *    - packages/core/src/modules/vc/linked-data-proofs/models/W3cJsonLdVerifiablePresentation.ts
 *      (dataIntegrityCryptosuites)
 * 4. Remove class/path compatibility alias:
 *    - packages/anoncreds/src/anoncreds-rs/AnonCredsDataIntegrityService.ts
 *
 * Notes:
 * - DataIntegrityProof (string proof type) is protocol-level and must remain.
 * - This checklist targets compatibility aliases only.
 * - Internal consumers should use canonical W3C bridge symbols only.
 */

export {
  AnonCredsW3cBridgeProof as DataIntegrityProof,
  type AnonCredsW3cBridgeProofOptions as DataIntegrityProofOptions,
} from './AnonCredsW3cBridgeProof'
export {
  ANONCREDS_W3C_BRIDGE_CRYPTOSUITE as ANONCREDS_DATA_INTEGRITY_CRYPTOSUITE,
  type AnonCredsW3cBridgeCreatePresentation as AnoncredsDataIntegrityCreatePresentation,
  AnonCredsW3cBridgeServiceSymbol as AnonCredsDataIntegrityServiceSymbol,
  type AnonCredsW3cBridgeVerifyPresentation as AnoncredsDataIntegrityVerifyPresentation,
  type IAnonCredsW3cBridgeService as IAnonCredsDataIntegrityService,
} from './IAnonCredsW3cBridgeService'
