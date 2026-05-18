import { CredoError } from '../../error'
import { isObject } from '../../utils/object'
import type { DataIntegrityCryptosuiteProof, DataIntegrityUnsecuredDocument } from './DataIntegrityProof'

// ─── Processing Error Taxonomy ───────────────────────────────────────────────

export enum DataIntegrityProcessingErrorCode {
  ParsingError = 'https://www.w3.org/ns/credentials#PARSING_ERROR',
  ProofGenerationError = 'https://w3id.org/security#PROOF_GENERATION_ERROR',
  ProofVerificationError = 'https://w3id.org/security#PROOF_VERIFICATION_ERROR',
  ProofTransformationError = 'https://w3id.org/security#PROOF_TRANSFORMATION_ERROR',
  InvalidDomainError = 'https://w3id.org/security#INVALID_DOMAIN_ERROR',
  InvalidChallengeError = 'https://w3id.org/security#INVALID_CHALLENGE_ERROR',
}

// ─── Public Issue Types ─────────────────────────────────────────────────────

export interface DataIntegrityProcessingIssue {
  type: DataIntegrityProcessingErrorCode
  title: string
  detail?: string
}

export type DataIntegrityIssueList = [DataIntegrityProcessingIssue, ...DataIntegrityProcessingIssue[]]

// ─── Public Result Types ────────────────────────────────────────────────────

export class DataIntegrityProcessingError extends CredoError {
  public readonly issue: DataIntegrityProcessingIssue

  public constructor(code: DataIntegrityProcessingErrorCode, title: string, detail?: string) {
    super(title)
    this.issue = createIssue(code, title, detail)
  }
}

export interface DataIntegrityCreateSuccess {
  created: true
  proof: DataIntegrityCryptosuiteProof
}

export interface DataIntegrityCreateFailure {
  created: false
  proof: null
  errors: DataIntegrityIssueList
}

export type DataIntegrityCreateResult = DataIntegrityCreateSuccess | DataIntegrityCreateFailure

export type DataIntegrityVerifySuccess = {
  verified: true
  verifiedDocument: DataIntegrityUnsecuredDocument
  mediaType: string | null
}

export type DataIntegrityVerifyFailure = {
  verified: false
  verifiedDocument: null
  mediaType: null
  errors: DataIntegrityIssueList
}

export type DataIntegrityVerifyResult = DataIntegrityVerifySuccess | DataIntegrityVerifyFailure

// ─── Issue Constructors ─────────────────────────────────────────────────────

export function createIssue(
  code: DataIntegrityProcessingErrorCode,
  title: string,
  detail?: string
): DataIntegrityProcessingIssue {
  return { type: code, title, detail }
}

export function createProofVerificationIssue(title: string, detail?: string): DataIntegrityProcessingIssue {
  return createIssue(DataIntegrityProcessingErrorCode.ProofVerificationError, title, detail)
}

// ─── Type Guards ────────────────────────────────────────────────────────────

export function isDataIntegrityProblemType(type: string): type is DataIntegrityProcessingErrorCode {
  return Object.values(DataIntegrityProcessingErrorCode).includes(type as DataIntegrityProcessingErrorCode)
}

export function isDataIntegrityProcessingIssue(issue: unknown): issue is DataIntegrityProcessingIssue {
  if (!isObject(issue)) return false

  const candidate = issue as Record<string, unknown>
  return typeof candidate.type === 'string' && typeof candidate.title === 'string'
}

// ─── Verification Result Builder ────────────────────────────────────────────

export function createInvalidResult(
  issue: DataIntegrityProcessingIssue,
  additionalIssues: DataIntegrityProcessingIssue[] = []
): DataIntegrityVerifyFailure {
  return {
    verified: false,
    verifiedDocument: null,
    mediaType: null,
    errors: [issue, ...additionalIssues],
  }
}

// ─── Issue Formatting ───────────────────────────────────────────────────────

const DEFAULT_VERIFICATION_FAILURE_MESSAGE = 'Data Integrity proof verification failed'

function formatIssueSummary(error: DataIntegrityProcessingIssue) {
  return `[${error.type}] ${error.title}`
}

function formatIssueDetail(error: DataIntegrityProcessingIssue) {
  return error.detail ? `${formatIssueSummary(error)}: ${error.detail}` : formatIssueSummary(error)
}

export function formatDataIntegrityIssueSummary(errors: DataIntegrityProcessingIssue[]): string {
  return errors.map(formatIssueSummary).join('; ')
}

export function formatDataIntegrityIssueDetail(errors: DataIntegrityProcessingIssue[]): string {
  const detail = errors.map(formatIssueDetail).join('; ')
  return detail || DEFAULT_VERIFICATION_FAILURE_MESSAGE
}

// ─── CredoError Conversion ──────────────────────────────────────────────────

export function createDataIntegrityCredoError(errors: DataIntegrityIssueList): CredoError {
  const message = formatDataIntegrityIssueDetail(errors)

  // Keep defensive runtime handling for malformed or force-cast empty issue lists.
  if (errors.length === 0) {
    return new CredoError(message)
  }

  const cause = new CredoError(`Data Integrity processing issues: ${formatDataIntegrityIssueSummary(errors)}`)
  return new CredoError(message, { cause })
}

// ─── Fail-Fast Assertions ────────────────────────────────────────────────────
export function assertCreated(result: DataIntegrityCreateResult): asserts result is DataIntegrityCreateSuccess {
  if (!result.created) {
    throw createDataIntegrityCredoError(result.errors)
  }
}

export function assertVerified(result: DataIntegrityVerifyResult): asserts result is DataIntegrityVerifySuccess {
  if (!result.verified) {
    throw createDataIntegrityCredoError(result.errors)
  }
}
