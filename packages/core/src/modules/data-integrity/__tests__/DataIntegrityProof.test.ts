import type { DataIntegrityCryptosuiteProof } from '../DataIntegrityProof'
import { assertIsDataIntegrityProof, createProofOptions } from '../DataIntegrityProof'
import { validateProofRequiredMembers } from '../proof-processing/validation'

describe('DataIntegrityProof', () => {
  test('creates proof options with type set to DataIntegrityProof', () => {
    const options = createProofOptions({
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
    const proof: DataIntegrityCryptosuiteProof = {
      type: 'DataIntegrityProof',
      cryptosuite: 'eddsa-jcs-2022',
      verificationMethod: 'did:example:issuer#key-1',
      proofPurpose: 'assertionMethod',
      proofValue: 'z3F4example',
    }

    expect(validateProofRequiredMembers(proof)).toBeUndefined()
    expect(() => assertIsDataIntegrityProof(proof)).not.toThrow()
  })

  test('validateProofRequiredMembers rejects proof without proofValue', () => {
    const invalidProof = {
      type: 'DataIntegrityProof',
      cryptosuite: 'eddsa-jcs-2022',
      verificationMethod: 'did:example:issuer#key-1',
      proofPurpose: 'assertionMethod',
    }

    expect(validateProofRequiredMembers(invalidProof)).toBe('Proof proofValue is required')
    expect(() => assertIsDataIntegrityProof(invalidProof)).toThrow(TypeError)
  })

  test('validateProofRequiredMembers rejects proof without verificationMethod', () => {
    const invalidProof = {
      type: 'DataIntegrityProof',
      cryptosuite: 'eddsa-jcs-2022',
      proofPurpose: 'assertionMethod',
      proofValue: 'z3F4example',
    }

    expect(validateProofRequiredMembers(invalidProof)).toBe('Proof verificationMethod is required')
    expect(() => assertIsDataIntegrityProof(invalidProof)).toThrow(TypeError)
  })

  test('validateProofRequiredMembers rejects proof without proofPurpose', () => {
    const invalidProof = {
      type: 'DataIntegrityProof',
      cryptosuite: 'eddsa-jcs-2022',
      verificationMethod: 'did:example:issuer#key-1',
      proofValue: 'z3F4example',
    }

    expect(validateProofRequiredMembers(invalidProof)).toBe('Proof proofPurpose is required')
    expect(() => assertIsDataIntegrityProof(invalidProof)).toThrow(TypeError)
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
    expect(() => assertIsDataIntegrityProof(invalidProof)).toThrow(TypeError)
  })
})
