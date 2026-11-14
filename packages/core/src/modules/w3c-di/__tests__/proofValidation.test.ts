import { MultiBaseEncoder, TypedArrayEncoder } from '../../../utils'
import { validateProofFieldFormats, validateProofTimestamps } from '../proof-processing/proofValidation'
import type { W3cDataIntegrityCryptosuiteProof } from '../W3cDataIntegrityProof'

const createProof = (proofValue: string): W3cDataIntegrityCryptosuiteProof => ({
  type: 'DataIntegrityProof',
  cryptosuite: 'test',
  proofPurpose: 'assertionMethod',
  verificationMethod: 'did:example:123#key-1',
  proofValue,
})

describe('validateProofFieldFormats', () => {
  it('accepts canonical base64url multibase values', () => {
    expect(validateProofFieldFormats(createProof('uAQ'))).toBeUndefined()
  })

  it.each(['uAQ==', 'uA?', 'uAB', 'u', 'UuAQ', 'mAQ'])('rejects invalid base64url multibase value %s', (value) => {
    expect(validateProofFieldFormats(createProof(value))).toBeDefined()
  })

  it('preserves base58btc validation', () => {
    const proofValue = MultiBaseEncoder.encode(TypedArrayEncoder.fromUtf8String('proof-value'), 'base58btc')
    expect(validateProofFieldFormats(createProof(proofValue))).toBeUndefined()
    expect(validateProofFieldFormats(createProof('z0'))).toBeDefined()
  })
})

describe('validateProofTimestamps', () => {
  it('rejects a leap second that Date cannot parse', () => {
    const proof = { ...createProof('uAQ'), expires: '2016-12-31T23:59:60Z' }
    expect(validateProofTimestamps(proof, { skewSeconds: 30 })?.errors[0]?.title).toBe(
      'Proof created and expires must be valid dates'
    )
  })
})
