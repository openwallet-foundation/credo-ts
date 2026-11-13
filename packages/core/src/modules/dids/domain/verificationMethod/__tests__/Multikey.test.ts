import { MultiBaseEncoder, TypedArrayEncoder, VarintEncoder } from '../../../../../utils'
import { PublicJwk } from '../../../../kms'
import { getMultikey, getPublicJwkFromMultikey, isMultikey } from '../Multikey'

const did = 'did:example:123'
const fingerprint = 'z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'

describe('Multikey', () => {
  it('preserves canonical fingerprints through verification method conversion', () => {
    const key = PublicJwk.fromFingerprint(fingerprint)
    const verificationMethod = getMultikey({ did, publicJwk: key })
    if (!isMultikey(verificationMethod)) throw new Error('Expected a Multikey verification method')

    expect(verificationMethod.publicKeyMultibase).toBe(fingerprint)
    expect(getPublicJwkFromMultikey(verificationMethod).fingerprint).toBe(fingerprint)
  })

  it('rejects malformed fingerprint key lengths', () => {
    const malformedFingerprint = MultiBaseEncoder.encode(
      TypedArrayEncoder.concat([VarintEncoder.encode(0xed), new Uint8Array(31)]),
      'base58btc'
    )
    const verificationMethod = getMultikey({ did, publicJwk: PublicJwk.fromFingerprint(fingerprint) })
    if (!isMultikey(verificationMethod)) throw new Error('Expected a Multikey verification method')
    verificationMethod.publicKeyMultibase = malformedFingerprint
    expect(() => getPublicJwkFromMultikey(verificationMethod)).toThrow('Invalid public key length')
  })
})
