/**
 * Public Data Integrity surface for external consumers of @credo-ts/core.
 * Keep this surface stable and semver-conscious.
 */
export type { DataIntegrityCryptosuite, DataIntegrityCryptosuiteInfo } from './cryptosuites/types'
export { DataIntegrityApi } from './DataIntegrityApi'
export type {
  DataIntegrityCreateFailure,
  DataIntegrityCreateResult,
  DataIntegrityCreateSuccess,
  DataIntegrityIssueList,
  DataIntegrityProcessingIssue,
  DataIntegrityVerifyFailure,
  DataIntegrityVerifyResult,
  DataIntegrityVerifySuccess,
} from './DataIntegrityError'
export { DataIntegrityProcessingErrorCode } from './DataIntegrityError'
export { DataIntegrityModule } from './DataIntegrityModule'
export type {
  DataIntegrityCryptosuiteProof,
  DataIntegrityCryptosuiteProofOptions,
  DataIntegrityProofSet,
  DataIntegrityProofSetSecuredDocument,
  DataIntegritySecuredDocument,
  DataIntegritySingleProofSecuredDocument,
  DataIntegrityUnsecuredDocument,
} from './DataIntegrityProof'
export type {
  DataIntegrityCreateProofOptions,
  DataIntegrityVerifyProofDocumentOptions,
  DataIntegrityVerifyProofOptions,
} from './DataIntegrityProofService'
