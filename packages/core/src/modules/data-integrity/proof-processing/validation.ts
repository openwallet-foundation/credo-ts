import { asArray, equalsIgnoreOrder } from '../../../utils'
import { MultiBaseEncoder } from '../../../utils/MultiBaseEncoder'
import type { DataIntegrityVerifyFailure } from '../DataIntegrityError'
import {
  createInvalidResult,
  createIssue,
  DataIntegrityProcessingError,
  DataIntegrityProcessingErrorCode,
  type DataIntegrityProcessingIssue,
} from '../DataIntegrityError'
import type { DataIntegrityCryptosuiteProof } from '../DataIntegrityProof'
import { buildValidatedProofReferenceGraph } from './chain'
import { isXsdDateTimeStamp } from './iso8601-datetime'

// ─── Exported validators ──────────────────────────────────────────────────────

/**
 * Implements VC Data Integrity v1.0 §4.4 step 4 required-member validation.
 * MANDATORY GATE: all downstream validation and cryptosuite verification assume this passed.
 */
export function validateProofRequiredMembers(proof: unknown): string | undefined {
  if (!proof || typeof proof !== 'object') {
    return 'Proof must be a non-null object'
  }

  const dataIntegrityProof = proof as Record<string, unknown>

  if (dataIntegrityProof.type !== 'DataIntegrityProof') {
    return "Proof type must be 'DataIntegrityProof'"
  }

  if (typeof dataIntegrityProof.cryptosuite !== 'string') {
    return 'Proof cryptosuite is required'
  }

  if (typeof dataIntegrityProof.proofPurpose !== 'string') {
    return 'Proof proofPurpose is required'
  }

  if (typeof dataIntegrityProof.verificationMethod !== 'string') {
    return 'Proof verificationMethod is required'
  }

  if (typeof dataIntegrityProof.proofValue !== 'string') {
    return 'Proof proofValue is required'
  }

  return undefined
}

/**
 * Implements VC Data Integrity v1.0 §4.5 steps 3.2-3.3 dependency validation.
 */
export function validateProofDependencies(proofs: DataIntegrityCryptosuiteProof[]): DataIntegrityProcessingIssue[] {
  const proofReferenceGraphResult = buildValidatedProofReferenceGraph(proofs)
  if (!proofReferenceGraphResult.ok) {
    return proofReferenceGraphResult.errors
  }

  return []
}

/**
 * Implements VC Data Integrity v1.0 §4.4 step 8 semantic field-format validation.
 *
 * Prerequisite: validateProofRequiredMembers() has already passed for this proof.
 */
export function validateProofFieldFormats(
  proof: DataIntegrityCryptosuiteProof
): DataIntegrityVerifyFailure | undefined {
  // Assumes validateProofRequiredMembers() has already validated proof structure.
  // This function validates only semantic/format constraints on required members.

  if (!isValidAbsoluteUrl(proof.verificationMethod)) {
    return createInvalidResult(
      createIssue(
        DataIntegrityProcessingErrorCode.ProofVerificationError,
        'Proof verificationMethod must be a valid URL',
        `Received '${proof.verificationMethod}'`
      )
    )
  }

  if (typeof proof.id === 'string') {
    if (!isValidAbsoluteUrl(proof.id)) {
      return createInvalidResult(
        createIssue(
          DataIntegrityProcessingErrorCode.ProofVerificationError,
          'Proof id must be a valid URL',
          `Received '${proof.id}'`
        )
      )
    }
  }

  if (typeof proof.created === 'string' && !isXsdDateTimeStamp(proof.created)) {
    return createInvalidResult(
      createIssue(
        DataIntegrityProcessingErrorCode.ProofVerificationError,
        'Proof created must be a valid dateTimeStamp',
        `Received '${proof.created}'`
      )
    )
  }

  if (typeof proof.expires === 'string' && !isXsdDateTimeStamp(proof.expires)) {
    return createInvalidResult(
      createIssue(
        DataIntegrityProcessingErrorCode.ProofVerificationError,
        'Proof expires must be a valid dateTimeStamp',
        `Received '${proof.expires}'`
      )
    )
  }

  // Validate proofValue using the shared multibase decoder so prefix and alphabet checks stay consistent.
  if (!MultiBaseEncoder.isValid(proof.proofValue)) {
    return createInvalidResult(
      createIssue(
        DataIntegrityProcessingErrorCode.ProofVerificationError,
        'Proof proofValue must be a valid multibase-encoded value'
      )
    )
  }

  return undefined
}

// ─── Proof option postcondition assertions ────────────────────────────────────

export function assertCreatedProofPostconditions(
  proof: DataIntegrityCryptosuiteProof,
  options: {
    verificationMethod: string
    proofPurpose: string
    challenge?: string
    nonce?: string
    created?: string
    expires?: string
    domain?: string | string[]
    previousProof?: string | string[]
  },
  expectedCryptosuite: string
): void {
  const throwPostconditionError = (detail: string) => {
    throw new DataIntegrityProcessingError(
      DataIntegrityProcessingErrorCode.ProofGenerationError,
      'Error creating Data Integrity proof',
      detail
    )
  }

  const proofValidationError = validateProofRequiredMembers(proof)
  if (proofValidationError) {
    throwPostconditionError(proofValidationError)
  }

  if (proof.cryptosuite !== expectedCryptosuite) {
    throwPostconditionError(
      `Created proof cryptosuite '${proof.cryptosuite}' does not match requested cryptosuite '${expectedCryptosuite}'`
    )
  }

  if (proof.verificationMethod !== options.verificationMethod) {
    throwPostconditionError(
      `Created proof verificationMethod '${proof.verificationMethod}' does not match requested '${options.verificationMethod}'`
    )
  }

  if (proof.proofPurpose !== options.proofPurpose) {
    throwPostconditionError(
      `Created proof proofPurpose '${proof.proofPurpose}' does not match requested '${options.proofPurpose}'`
    )
  }

  if (options.challenge !== undefined && proof.challenge !== options.challenge) {
    throwPostconditionError(
      `Created proof challenge '${proof.challenge ?? 'undefined'}' does not match requested '${options.challenge}'`
    )
  }

  if (options.nonce !== undefined && proof.nonce !== options.nonce) {
    throwPostconditionError(
      `Created proof nonce '${proof.nonce ?? 'undefined'}' does not match requested '${options.nonce}'`
    )
  }

  if (options.created !== undefined && proof.created !== options.created) {
    throwPostconditionError(
      `Created proof created '${proof.created ?? 'undefined'}' does not match requested '${options.created}'`
    )
  }

  if (options.expires !== undefined && proof.expires !== options.expires) {
    throwPostconditionError(
      `Created proof expires '${proof.expires ?? 'undefined'}' does not match requested '${options.expires}'`
    )
  }

  if (options.domain !== undefined) {
    const expectedDomain = [...new Set(asArray(options.domain))]
    const actualDomain = [...new Set(asArray(proof.domain))]
    if (!equalsIgnoreOrder(expectedDomain, actualDomain)) {
      throwPostconditionError('Created proof domain does not match requested domain')
    }
  }

  if (options.previousProof !== undefined) {
    const expectedPreviousProof = [...new Set(asArray(options.previousProof))]
    const actualPreviousProof = [...new Set(asArray(proof.previousProof))]
    if (!equalsIgnoreOrder(expectedPreviousProof, actualPreviousProof)) {
      throwPostconditionError('Created proof previousProof does not match requested previousProof')
    }
  }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function isValidAbsoluteUrl(value: string): boolean {
  try {
    // WHATWG URL accepts DID URLs, URNs, and HTTPS URLs used by Data Integrity proofs.
    const parsedUrl = new URL(value)
    return parsedUrl.protocol.length > 0
  } catch {
    return false
  }
}
