import { CredoError } from '../../error'
import { isObject } from '../../utils/object'
import type { W3cDataIntegrityCryptosuiteProof, W3cDataIntegrityUnsecuredDocument } from './W3cDataIntegrityProof'

// ─── Processing Error Taxonomy ───────────────────────────────────────────────

export enum W3cDataIntegrityProcessingErrorCode {
  ParsingError = 'https://www.w3.org/ns/credentials#PARSING_ERROR',
  ProofGenerationError = 'https://w3id.org/security#PROOF_GENERATION_ERROR',
  ProofVerificationError = 'https://w3id.org/security#PROOF_VERIFICATION_ERROR',
  ProofTransformationError = 'https://w3id.org/security#PROOF_TRANSFORMATION_ERROR',
  InvalidDomainError = 'https://w3id.org/security#INVALID_DOMAIN_ERROR',
  InvalidChallengeError = 'https://w3id.org/security#INVALID_CHALLENGE_ERROR',
}

// ─── Public Issue Types ─────────────────────────────────────────────────────

export interface W3cDataIntegrityProcessingIssue {
  type: W3cDataIntegrityProcessingErrorCode
  title: string
  detail?: string
}

export type W3cDataIntegrityIssueList = [W3cDataIntegrityProcessingIssue, ...W3cDataIntegrityProcessingIssue[]]

// ─── Public Result Types ────────────────────────────────────────────────────

export class W3cDataIntegrityProcessingError extends CredoError {
  public readonly issue: W3cDataIntegrityProcessingIssue

  public constructor(code: W3cDataIntegrityProcessingErrorCode, title: string, detail?: string) {
    super(title)
    this.issue = createIssue(code, title, detail)
  }
}

export interface W3cDataIntegrityCreateSuccess {
  created: true
  proof: W3cDataIntegrityCryptosuiteProof
}

export interface W3cDataIntegrityCreateFailure {
  created: false
  proof: null
  errors: W3cDataIntegrityIssueList
}

export type W3cDataIntegrityCreateResult = W3cDataIntegrityCreateSuccess | W3cDataIntegrityCreateFailure

export type W3cDataIntegrityVerifySuccess = {
  verified: true
  verifiedDocument: W3cDataIntegrityUnsecuredDocument
  mediaType: string | null
}

export type W3cDataIntegrityVerifyFailure = {
  verified: false
  verifiedDocument: null
  mediaType: null
  errors: W3cDataIntegrityIssueList
}

export type W3cDataIntegrityVerifyResult = W3cDataIntegrityVerifySuccess | W3cDataIntegrityVerifyFailure

// ─── Issue Constructors ─────────────────────────────────────────────────────

export function createIssue(
  code: W3cDataIntegrityProcessingErrorCode,
  title: string,
  detail?: string
): W3cDataIntegrityProcessingIssue {
  return { type: code, title, detail }
}

export function createProofVerificationIssue(title: string, detail?: string): W3cDataIntegrityProcessingIssue {
  return createIssue(W3cDataIntegrityProcessingErrorCode.ProofVerificationError, title, detail)
}

// ─── Type Guards ────────────────────────────────────────────────────────────

export function isW3cDataIntegrityProblemType(type: string): type is W3cDataIntegrityProcessingErrorCode {
  return Object.values(W3cDataIntegrityProcessingErrorCode).includes(type as W3cDataIntegrityProcessingErrorCode)
}

export function isW3cDataIntegrityProcessingIssue(issue: unknown): issue is W3cDataIntegrityProcessingIssue {
  if (!isObject(issue)) return false

  const candidate = issue as Record<string, unknown>
  return typeof candidate.type === 'string' && typeof candidate.title === 'string'
}

// ─── Verification Result Builder ────────────────────────────────────────────

export function createInvalidResult(
  issue: W3cDataIntegrityProcessingIssue,
  additionalIssues: W3cDataIntegrityProcessingIssue[] = []
): W3cDataIntegrityVerifyFailure {
  return {
    verified: false,
    verifiedDocument: null,
    mediaType: null,
    errors: [issue, ...additionalIssues],
  }
}

// ─── Issue Formatting ───────────────────────────────────────────────────────

const DEFAULT_VERIFICATION_FAILURE_MESSAGE = 'Data Integrity proof verification failed'

function formatIssueSummary(error: W3cDataIntegrityProcessingIssue) {
  return `[${error.type}] ${error.title}`
}

function formatIssueDetail(error: W3cDataIntegrityProcessingIssue) {
  return error.detail ? `${formatIssueSummary(error)}: ${error.detail}` : formatIssueSummary(error)
}

export function formatW3cDataIntegrityIssueSummary(errors: W3cDataIntegrityProcessingIssue[]): string {
  return errors.map(formatIssueSummary).join('; ')
}

export function formatW3cDataIntegrityIssueDetail(errors: W3cDataIntegrityProcessingIssue[]): string {
  const detail = errors.map(formatIssueDetail).join('; ')
  return detail || DEFAULT_VERIFICATION_FAILURE_MESSAGE
}

// ─── CredoError Conversion ──────────────────────────────────────────────────

export function createW3cDataIntegrityCredoError(errors: W3cDataIntegrityIssueList): CredoError {
  const message = formatW3cDataIntegrityIssueDetail(errors)

  // Keep defensive runtime handling for malformed or force-cast empty issue lists.
  if (errors.length === 0) {
    return new CredoError(message)
  }

  const cause = new CredoError(`Data Integrity processing issues: ${formatW3cDataIntegrityIssueSummary(errors)}`)
  return new CredoError(message, { cause })
}

// ─── Fail-Fast Assertions ────────────────────────────────────────────────────
export function assertCreated(result: W3cDataIntegrityCreateResult): asserts result is W3cDataIntegrityCreateSuccess {
  if (!result.created) {
    throw createW3cDataIntegrityCredoError(result.errors)
  }
}

export function assertVerified(result: W3cDataIntegrityVerifyResult): asserts result is W3cDataIntegrityVerifySuccess {
  if (!result.verified) {
    throw createW3cDataIntegrityCredoError(result.errors)
  }
}
