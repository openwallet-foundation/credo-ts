/**
 * Internal Data Integrity surface for internal modules and direct-import consumers
 */
export { EddsaJcs2022Cryptosuite } from './cryptosuites/eddsa-jcs-2022/EddsaJcs2022Cryptosuite'
export type { DataIntegrityCryptosuite, DataIntegrityCryptosuiteInfo } from './cryptosuites/types'
export { DataIntegrityCryptosuiteToken } from './cryptosuites/types'
export { W3cDataIntegrityApi } from './W3cDataIntegrityApi'
export { W3cDataIntegrityCryptosuiteRegistry } from './W3cDataIntegrityCryptosuiteRegistry'
export type {
  DataIntegrityCreateResult,
  DataIntegrityIssueList,
  DataIntegrityProcessingIssue,
  DataIntegrityVerifyFailure,
  DataIntegrityVerifyResult,
} from './DataIntegrityError'
export {
  assertCreated,
  assertVerified,
  createDataIntegrityCredoError,
  createInvalidResult,
  createIssue,
  createProofVerificationIssue,
  DataIntegrityProcessingError,
  DataIntegrityProcessingErrorCode,
  formatDataIntegrityIssueDetail,
  formatDataIntegrityIssueSummary,
  isDataIntegrityProblemType,
  isDataIntegrityProcessingIssue,
} from './DataIntegrityError'
export type {
  DataIntegrityCryptosuiteProof,
  DataIntegrityCryptosuiteProofOptions,
  DataIntegrityDomain,
  DataIntegrityPreviousProofReference,
  DataIntegrityProofSet,
  DataIntegrityProofSetSecuredDocument,
  DataIntegritySecuredDocument,
  DataIntegritySingleProofSecuredDocument,
  DataIntegrityUnsecuredDocument,
} from './DataIntegrityProof'
export {
  assertDataIntegrityDocument,
  assertIsDataIntegrityProof,
  assertMultiProofDocument,
  assertSingleProofDocument,
  createProofOptions,
} from './DataIntegrityProof'
export type {
  DataIntegrityCreateProofOptions,
  DataIntegrityVerifyProofDocumentOptions,
  DataIntegrityVerifyProofOptions,
} from './W3cDataIntegrityProofService'
export { W3cDataIntegrityProofService } from './W3cDataIntegrityProofService'
