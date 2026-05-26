/**
 * Public Data Integrity surface for external consumers of @credo-ts/core.
 * Keep this surface stable and semver-conscious.
 */
export type { DataIntegrityCryptosuite, DataIntegrityCryptosuiteInfo } from './cryptosuites/types'
export { W3cDataIntegrityApi } from './W3cDataIntegrityApi'
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
export { W3cDataIntegrityModule } from './W3cDataIntegrityModule'
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
} from './W3cDataIntegrityProofService'
