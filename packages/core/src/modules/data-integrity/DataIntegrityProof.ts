import { isObject } from '../../utils/object'
import { validateProofRequiredMembers } from './proof-processing/validation'

export type DataIntegrityDomain = string | string[]
export type DataIntegrityPreviousProofReference = string | string[]

export interface DataIntegrityCryptosuiteProofOptions {
  id?: string
  type: 'DataIntegrityProof'
  cryptosuite: string
  proofPurpose: string
  verificationMethod: string
  created?: string
  expires?: string
  challenge?: string
  domain?: DataIntegrityDomain
  nonce?: string
  previousProof?: DataIntegrityPreviousProofReference
  '@context'?: unknown
}

export function createProofOptions(
  options: Omit<DataIntegrityCryptosuiteProofOptions, 'type' | '@context' | 'id'>
): DataIntegrityCryptosuiteProofOptions {
  return {
    type: 'DataIntegrityProof',
    ...options,
  }
}

export interface DataIntegrityCryptosuiteProof extends DataIntegrityCryptosuiteProofOptions {
  proofValue: string
}

export type DataIntegrityUnsecuredDocument = Record<string, unknown>

export type DataIntegrityProofSet = DataIntegrityCryptosuiteProof | DataIntegrityCryptosuiteProof[]

export type DataIntegritySingleProofSecuredDocument = DataIntegrityUnsecuredDocument & {
  proof: DataIntegrityCryptosuiteProof
}

export type DataIntegrityProofSetSecuredDocument = DataIntegrityUnsecuredDocument & {
  proof: DataIntegrityCryptosuiteProof[]
}

export type DataIntegritySecuredDocument = DataIntegrityUnsecuredDocument & {
  proof: DataIntegrityProofSet
}

/**
 * Enforces required member validation for Data Integrity proofs.
 * See VC Data Integrity v1.0 §4.4 step 4.
 */
export function assertIsDataIntegrityProof(proof: unknown): asserts proof is DataIntegrityCryptosuiteProof {
  const validationError = validateProofRequiredMembers(proof)
  if (validationError) {
    throw new TypeError(validationError)
  }
}

/**
 * Enforces single-proof secured document shape for VC Data Integrity v1.0 §4.4 flows.
 */
export function assertSingleProofDocument(doc: unknown): asserts doc is DataIntegritySingleProofSecuredDocument {
  if (!isObject(doc)) {
    throw new TypeError('Secured document must be a non-null object')
  }

  const securedDocument = doc as Record<string, unknown>
  if (Array.isArray(securedDocument.proof)) {
    throw new TypeError('Proof sets are not accepted by verifyProof; call verifyProofSetAndChain instead')
  }

  assertIsDataIntegrityProof(securedDocument.proof)
}

/**
 * Enforces proof-set secured document shape for VC Data Integrity v1.0 §4.5 flows.
 */
export function assertMultiProofDocument(doc: unknown): asserts doc is DataIntegrityProofSetSecuredDocument {
  if (!isObject(doc)) {
    throw new TypeError('Secured document must be a non-null object')
  }

  const securedDocument = doc as Record<string, unknown>
  if (!Array.isArray(securedDocument.proof)) {
    throw new TypeError('Proof set expected for verifyProofSetAndChain')
  }

  if (securedDocument.proof.length === 0) {
    throw new TypeError('Proof set expected for verifyProofSetAndChain')
  }
}

/**
 * Enforces general secured document shape for Data Integrity single- or multi-proof inputs.
 */
export function assertDataIntegrityDocument(doc: unknown): asserts doc is DataIntegritySecuredDocument {
  if (!isObject(doc)) {
    throw new TypeError('Secured document must be a non-null object')
  }

  const securedDocument = doc as Record<string, unknown>
  if (Array.isArray(securedDocument.proof)) {
    assertMultiProofDocument(securedDocument)
    return
  }

  assertSingleProofDocument(securedDocument)
}
