import { isObject } from '../../utils/object'
import { validateProofRequiredMembers } from './proof-processing/validation'

export type W3cDataIntegrityDomain = string | string[]
export type W3cDataIntegrityPreviousProofReference = string | string[]

export interface W3cDataIntegrityCryptosuiteProofOptions {
  id?: string
  type: 'DataIntegrityProof'
  cryptosuite: string
  proofPurpose: string
  verificationMethod: string
  created?: string
  expires?: string
  challenge?: string
  domain?: W3cDataIntegrityDomain
  nonce?: string
  previousProof?: W3cDataIntegrityPreviousProofReference
  '@context'?: unknown
}

export function createW3cDataIntegrityProofOptions(
  options: Omit<W3cDataIntegrityCryptosuiteProofOptions, 'type' | '@context' | 'id'>
): W3cDataIntegrityCryptosuiteProofOptions {
  return {
    type: 'DataIntegrityProof',
    ...options,
  }
}

export interface W3cDataIntegrityCryptosuiteProof extends W3cDataIntegrityCryptosuiteProofOptions {
  proofValue: string
}

export type W3cDataIntegrityUnsecuredDocument = Record<string, unknown>

export type W3cDataIntegrityProofSet = W3cDataIntegrityCryptosuiteProof | W3cDataIntegrityCryptosuiteProof[]

export type W3cDataIntegritySingleProofSecuredDocument = W3cDataIntegrityUnsecuredDocument & {
  proof: W3cDataIntegrityCryptosuiteProof
}

export type W3cDataIntegrityProofSetSecuredDocument = W3cDataIntegrityUnsecuredDocument & {
  proof: W3cDataIntegrityCryptosuiteProof[]
}

export type W3cDataIntegritySecuredDocument = W3cDataIntegrityUnsecuredDocument & {
  proof: W3cDataIntegrityProofSet
}

/**
 * Enforces required member validation for Data Integrity proofs.
 * See VC Data Integrity v1.0 §4.4 step 4.
 */
export function assertIsW3cDataIntegrityProof(proof: unknown): asserts proof is W3cDataIntegrityCryptosuiteProof {
  const validationError = validateProofRequiredMembers(proof)
  if (validationError) {
    throw new TypeError(validationError)
  }
}

/**
 * Enforces single-proof secured document shape for VC Data Integrity v1.0 §4.4 flows.
 */
export function assertSingleProofDocument(doc: unknown): asserts doc is W3cDataIntegritySingleProofSecuredDocument {
  if (!isObject(doc)) {
    throw new TypeError('Secured document must be a non-null object')
  }

  const securedDocument = doc as Record<string, unknown>
  if (Array.isArray(securedDocument.proof)) {
    throw new TypeError('Proof sets are not accepted by verifyProof; call verifyProofSetAndChain instead')
  }

  assertIsW3cDataIntegrityProof(securedDocument.proof)
}

/**
 * Enforces proof-set secured document shape for VC Data Integrity v1.0 §4.5 flows.
 */
export function assertMultiProofDocument(doc: unknown): asserts doc is W3cDataIntegrityProofSetSecuredDocument {
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
export function assertW3cDataIntegrityDocument(doc: unknown): asserts doc is W3cDataIntegritySecuredDocument {
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
