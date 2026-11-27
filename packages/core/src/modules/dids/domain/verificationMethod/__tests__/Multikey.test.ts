import { MultiBaseEncoder, TypedArrayEncoder, VarintEncoder } from '../../../../../utils'
import { PublicJwk } from '../../../../kms'
import { MlDsa44PublicJwk } from '../../../../kms/jwk/kty/akp/MlDsa44PublicJwk'
import { getMultikey, getPublicJwkFromMultikey, isMultikey } from '../Multikey'

const did = 'did:example:123'
const fingerprint = 'z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'

describe('Multikey', () => {
  it('preserves canonical fingerprints through verification method conversion', () => {
    const key = PublicJwk.fromFingerprint(fingerprint)
    const verificationMethod = getMultikey({ did, publicJwk: key })
    if (!isMultikey(verificationMethod)) throw new Error('Expected a Multikey verification method')

    expect(verificationMethod.publicKeyMultibase).toBe(fingerprint)
    const publicJwk = getPublicJwkFromMultikey(verificationMethod)
    expect(publicJwk.toJson()).toMatchObject({ kty: 'OKP', crv: 'Ed25519' })
    expect(publicJwk.fingerprint).toBe(fingerprint)
  })

  it('parses a u-prefixed ML-DSA-44 Multikey without assuming Ed25519', () => {
    const rawPublicKey = new Uint8Array(1312).fill(0x42)
    const publicKeyMultibase = MultiBaseEncoder.encode(
      TypedArrayEncoder.concat([VarintEncoder.encode(0x1210), rawPublicKey]),
      'base64url'
    )
    const verificationMethod = {
      id: `${did}#${publicKeyMultibase}`,
      type: 'Multikey' as const,
      controller: did,
      publicKeyMultibase,
    }

    const publicJwk = getPublicJwkFromMultikey(verificationMethod)

    expect(publicKeyMultibase[0]).toBe('u')
    expect(publicJwk.is(MlDsa44PublicJwk)).toBe(true)
    expect(publicJwk.toJson()).toEqual({
      kty: 'AKP',
      alg: 'ML-DSA-44',
      pub: TypedArrayEncoder.toBase64Url(rawPublicKey),
    })
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
