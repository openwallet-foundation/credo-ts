import { asArray, equalsIgnoreOrder } from '../../../utils'
import { MultiBaseEncoder } from '../../../utils/MultiBaseEncoder'
import type { W3cDataIntegrityVerifyFailure } from '../W3cDataIntegrityError'
import {
  createInvalidResult,
  createIssue,
  W3cDataIntegrityProcessingError,
  W3cDataIntegrityProcessingErrorCode,
} from '../W3cDataIntegrityError'
import type { W3cDataIntegrityCryptosuiteProof } from '../W3cDataIntegrityProof'
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
 * Implements VC Data Integrity v1.0 §4.4 step 8 semantic field-format validation.
 *
 * Prerequisite: validateProofRequiredMembers() has already passed for this proof.
 */
export function validateProofFieldFormats(
  proof: W3cDataIntegrityCryptosuiteProof
): W3cDataIntegrityVerifyFailure | undefined {
  // Assumes validateProofRequiredMembers() has already validated proof structure.
  // This function validates only semantic/format constraints on required members.

  if (!isValidAbsoluteUrl(proof.verificationMethod)) {
    return createInvalidResult(
      createIssue(
        W3cDataIntegrityProcessingErrorCode.ProofVerificationError,
        'Proof verificationMethod must be a valid URL',
        `Received '${proof.verificationMethod}'`
      )
    )
  }

  if (typeof proof.id === 'string') {
    if (!isValidAbsoluteUrl(proof.id)) {
      return createInvalidResult(
        createIssue(
          W3cDataIntegrityProcessingErrorCode.ProofVerificationError,
          'Proof id must be a valid URL',
          `Received '${proof.id}'`
        )
      )
    }
  }

  if (typeof proof.created === 'string' && !isXsdDateTimeStamp(proof.created)) {
    return createInvalidResult(
      createIssue(
        W3cDataIntegrityProcessingErrorCode.ProofVerificationError,
        'Proof created must be a valid dateTimeStamp',
        `Received '${proof.created}'`
      )
    )
  }

  if (typeof proof.expires === 'string' && !isXsdDateTimeStamp(proof.expires)) {
    return createInvalidResult(
      createIssue(
        W3cDataIntegrityProcessingErrorCode.ProofVerificationError,
        'Proof expires must be a valid dateTimeStamp',
        `Received '${proof.expires}'`
      )
    )
  }

  // Validate proofValue using the shared multibase decoder so prefix and alphabet checks stay consistent.
  if (!MultiBaseEncoder.isValid(proof.proofValue)) {
    return createInvalidResult(
      createIssue(
        W3cDataIntegrityProcessingErrorCode.ProofVerificationError,
        'Proof proofValue must be a valid multibase-encoded value'
      )
    )
  }

  return undefined
}

// ─── Proof option postcondition assertions ────────────────────────────────────

export function assertCreatedProofPostconditions(
  proof: W3cDataIntegrityCryptosuiteProof,
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
    throw new W3cDataIntegrityProcessingError(
      W3cDataIntegrityProcessingErrorCode.ProofGenerationError,
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
