/**
 * Internal Data Integrity surface for internal modules and direct-import consumers
 */
export { EddsaJcs2022Cryptosuite } from './cryptosuites/eddsa-jcs-2022/EddsaJcs2022Cryptosuite'
export type { W3cDataIntegrityCryptosuite, W3cDataIntegrityCryptosuiteInfo } from './cryptosuites/types'
export { W3cDataIntegrityCryptosuiteToken } from './cryptosuites/types'
export { W3cDataIntegrityApi } from './W3cDataIntegrityApi'
export { W3cDataIntegrityCryptosuiteRegistry } from './W3cDataIntegrityCryptosuiteRegistry'
export type {
  W3cDataIntegrityCreateResult,
  W3cDataIntegrityIssueList,
  W3cDataIntegrityProcessingIssue,
  W3cDataIntegrityVerifyFailure,
  W3cDataIntegrityVerifyResult,
} from './W3cDataIntegrityError'
export {
  assertCreated,
  assertVerified,
  createInvalidResult,
  createIssue,
  createProofVerificationIssue,
  createW3cDataIntegrityCredoError,
  formatW3cDataIntegrityIssueDetail,
  formatW3cDataIntegrityIssueSummary,
  isW3cDataIntegrityProblemType,
  isW3cDataIntegrityProcessingIssue,
  W3cDataIntegrityProcessingError,
  W3cDataIntegrityProcessingErrorCode,
} from './W3cDataIntegrityError'
export type {
  W3cDataIntegrityCryptosuiteProof,
  W3cDataIntegrityCryptosuiteProofOptions,
  W3cDataIntegrityDomain,
  W3cDataIntegrityPreviousProofReference,
  W3cDataIntegrityProofSet,
  W3cDataIntegrityProofSetSecuredDocument,
  W3cDataIntegritySecuredDocument,
  W3cDataIntegritySingleProofSecuredDocument,
  W3cDataIntegrityUnsecuredDocument,
} from './W3cDataIntegrityProof'
export {
  assertIsW3cDataIntegrityProof,
  assertMultiProofDocument,
  assertSingleProofDocument,
  assertW3cDataIntegrityDocument,
  createW3cDataIntegrityProofOptions,
} from './W3cDataIntegrityProof'
export type {
  W3cDataIntegrityCreateProofOptions,
  W3cDataIntegrityVerifyProofDocumentOptions,
  W3cDataIntegrityVerifyProofOptions,
} from './W3cDataIntegrityProofService'
export { W3cDataIntegrityProofService } from './W3cDataIntegrityProofService'
