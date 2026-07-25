/**
 * Temporary compatibility aliases for the AnonCreds W3C credential rename.
 *
 * Major-version cleanup checklist (separate from DataIntegrity namespace):
 * 1. Delete this file:
 *    - packages/core/src/modules/vc/anoncreds-w3c-credential/deprecated.ts
 * 2. Stop exporting this file from the credential barrel:
 *    - packages/core/src/modules/vc/anoncreds-w3c-credential/index.ts
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
 * - Internal consumers should use canonical W3C credential symbols only.
 */

export {
  AnonCredsW3cCredentialProof as DataIntegrityProof,
  type AnonCredsW3cCredentialProofOptions as DataIntegrityProofOptions,
} from './AnonCredsW3cCredentialProof'
export {
  ANONCREDS_W3C_CREDENTIAL_CRYPTOSUITE as ANONCREDS_DATA_INTEGRITY_CRYPTOSUITE,
  type AnonCredsW3cCredentialCreatePresentation as AnoncredsDataIntegrityCreatePresentation,
  AnonCredsW3cCredentialServiceSymbol as AnonCredsDataIntegrityServiceSymbol,
  type AnonCredsW3cCredentialVerifyPresentation as AnoncredsDataIntegrityVerifyPresentation,
  type IAnonCredsW3cCredentialService as IAnonCredsDataIntegrityService,
} from './IAnonCredsW3cCredentialService'
