/**
 * Public Data Integrity surface for external consumers of @credo-ts/core.
 * Keep this surface stable and semver-conscious.
 */
export type { W3cDataIntegrityCryptosuite, W3cDataIntegrityCryptosuiteInfo } from './cryptosuites/types'
export { W3cDataIntegrityApi } from './W3cDataIntegrityApi'
export type {
  W3cDataIntegrityCreateFailure,
  W3cDataIntegrityCreateResult,
  W3cDataIntegrityCreateSuccess,
  W3cDataIntegrityIssueList,
  W3cDataIntegrityProcessingIssue,
  W3cDataIntegrityVerifyFailure,
  W3cDataIntegrityVerifyResult,
  W3cDataIntegrityVerifySuccess,
} from './W3cDataIntegrityError'
export { W3cDataIntegrityProcessingErrorCode } from './W3cDataIntegrityError'
export { W3cDataIntegrityModule } from './W3cDataIntegrityModule'
export type {
  W3cDataIntegrityCryptosuiteProof,
  W3cDataIntegrityCryptosuiteProofOptions,
  W3cDataIntegrityProofSet,
  W3cDataIntegrityProofSetSecuredDocument,
  W3cDataIntegritySecuredDocument,
  W3cDataIntegritySingleProofSecuredDocument,
  W3cDataIntegrityUnsecuredDocument,
} from './W3cDataIntegrityProof'
export type {
  W3cDataIntegrityCreateProofOptions,
  W3cDataIntegrityVerifyProofDocumentOptions,
  W3cDataIntegrityVerifyProofOptions,
} from './W3cDataIntegrityProofService'
