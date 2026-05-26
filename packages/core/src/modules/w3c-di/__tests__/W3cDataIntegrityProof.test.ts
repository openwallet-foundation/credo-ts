import { validateProofRequiredMembers } from '../proof-processing/validation'
import type { W3cDataIntegrityCryptosuiteProof } from '../W3cDataIntegrityProof'
import { assertIsW3cDataIntegrityProof, createW3cDataIntegrityProofOptions } from '../W3cDataIntegrityProof'

describe('DataIntegrityProof', () => {
  test('creates proof options with type set to DataIntegrityProof', () => {
    const options = createW3cDataIntegrityProofOptions({
      cryptosuite: 'eddsa-jcs-2022',
      verificationMethod: 'did:example:issuer#key-1',
      proofPurpose: 'assertionMethod',
      challenge: 'challenge-1',
      domain: ['example.com'],
    })

    expect(options).toEqual({
      type: 'DataIntegrityProof',
      cryptosuite: 'eddsa-jcs-2022',
      verificationMethod: 'did:example:issuer#key-1',
      proofPurpose: 'assertionMethod',
      challenge: 'challenge-1',
      domain: ['example.com'],
    })
  })

  test('validateProofRequiredMembers returns undefined for valid proof shape', () => {
    const proof: W3cDataIntegrityCryptosuiteProof = {
      type: 'DataIntegrityProof',
      cryptosuite: 'eddsa-jcs-2022',
      verificationMethod: 'did:example:issuer#key-1',
      proofPurpose: 'assertionMethod',
      proofValue: 'z3F4example',
    }

    expect(validateProofRequiredMembers(proof)).toBeUndefined()
    expect(() => assertIsW3cDataIntegrityProof(proof)).not.toThrow()
  })

  test('validateProofRequiredMembers rejects proof without proofValue', () => {
    const invalidProof = {
      type: 'DataIntegrityProof',
      cryptosuite: 'eddsa-jcs-2022',
      verificationMethod: 'did:example:issuer#key-1',
      proofPurpose: 'assertionMethod',
    }

    expect(validateProofRequiredMembers(invalidProof)).toBe('Proof proofValue is required')
    expect(() => assertIsW3cDataIntegrityProof(invalidProof)).toThrow(TypeError)
  })

  test('validateProofRequiredMembers rejects proof without verificationMethod', () => {
    const invalidProof = {
      type: 'DataIntegrityProof',
      cryptosuite: 'eddsa-jcs-2022',
      proofPurpose: 'assertionMethod',
      proofValue: 'z3F4example',
    }

    expect(validateProofRequiredMembers(invalidProof)).toBe('Proof verificationMethod is required')
    expect(() => assertIsW3cDataIntegrityProof(invalidProof)).toThrow(TypeError)
  })

  test('validateProofRequiredMembers rejects proof without proofPurpose', () => {
    const invalidProof = {
      type: 'DataIntegrityProof',
      cryptosuite: 'eddsa-jcs-2022',
      verificationMethod: 'did:example:issuer#key-1',
      proofValue: 'z3F4example',
    }

    expect(validateProofRequiredMembers(invalidProof)).toBe('Proof proofPurpose is required')
    expect(() => assertIsW3cDataIntegrityProof(invalidProof)).toThrow(TypeError)
  })

  test('validateProofRequiredMembers rejects proof with invalid type', () => {
    const invalidProof = {
      type: 'InvalidProof',
      cryptosuite: 'eddsa-jcs-2022',
      verificationMethod: 'did:example:issuer#key-1',
      proofPurpose: 'assertionMethod',
      proofValue: 'z3F4example',
    }

    expect(validateProofRequiredMembers(invalidProof)).toBe("Proof type must be 'DataIntegrityProof'")
    expect(() => assertIsW3cDataIntegrityProof(invalidProof)).toThrow(TypeError)
  })
})
