import { MultiBaseEncoder, VarintEncoder } from '../../../../../utils'
import didKeyEd25519 from '../../../../dids/__tests__/__fixtures__/didKeyEd25519.json'
import didKeyK256 from '../../../../dids/__tests__/__fixtures__/didKeyK256.json'
import didKeyP256 from '../../../../dids/__tests__/__fixtures__/didKeyP256.json'
import didKeyP384 from '../../../../dids/__tests__/__fixtures__/didKeyP384.json'
import didKeyP521 from '../../../../dids/__tests__/__fixtures__/didKeyP521.json'
import didKeyX25519 from '../../../../dids/__tests__/__fixtures__/didKeyX25519.json'
import { PublicJwk } from '../../PublicJwk'
import { P256PublicJwk } from '../ec/P256PublicJwk'
import { P384PublicJwk } from '../ec/P384PublicJwk'
import { P521PublicJwk } from '../ec/P521PublicJwk'
import { Secp256k1PublicJwk } from '../ec/Secp256k1PublicJwk'
import { Ed25519PublicJwk } from '../okp/Ed25519PublicJwk'
import { X25519PublicJwk } from '../okp/X25519PublicJwk'
import { RsaPublicJwk } from '../rsa/RsaPublicJwk'

const ecFixtures = [
  { fixture: didKeyK256, JwkClass: Secp256k1PublicJwk },
  { fixture: didKeyP256, JwkClass: P256PublicJwk },
  { fixture: didKeyP384, JwkClass: P384PublicJwk },
  { fixture: didKeyP521, JwkClass: P521PublicJwk },
]
const okpFixtures = [
  { fixture: didKeyEd25519, JwkClass: Ed25519PublicJwk },
  { fixture: didKeyX25519, JwkClass: X25519PublicJwk },
]

describe('fromMulticodec', () => {
  it.each([...ecFixtures, ...okpFixtures])(
    'round-trips valid payloads and rejects invalid lengths for $fixture.id',
    ({ fixture, JwkClass }) => {
      const fingerprint = fixture.id.slice('did:key:'.length)
      const { data } = MultiBaseEncoder.decode(fingerprint)
      const [, prefixLength] = VarintEncoder.decode(data)
      const payload = data.slice(prefixLength)
      const instance = JwkClass.fromMulticodec(payload)
      expect(PublicJwk.fromPublicJwk(instance.jwk).fingerprint).toBe(fingerprint)

      for (const invalid of [new Uint8Array(), payload.slice(0, -1), new Uint8Array([...payload, 0])]) {
        expect(() => JwkClass.fromMulticodec(invalid)).toThrow('Invalid public key length')
      }
    }
  )

  it.each(ecFixtures)('requires compressed SEC1 payloads for $fixture.id', ({ fixture, JwkClass }) => {
    const publicJwk = PublicJwk.fromFingerprint(fixture.id.slice('did:key:'.length))
    const publicKey = publicJwk.publicKey
    if (publicKey.kty !== 'EC') throw new Error('Expected an EC fixture')
    const instance = JwkClass.fromPublicKey(publicKey.publicKey)
    expect(PublicJwk.fromPublicJwk(instance.jwk).fingerprint).toBe(publicJwk.fingerprint)
    expect(() => JwkClass.fromMulticodec(publicKey.publicKey)).toThrow('Invalid public key length')

    for (const header of [0x00, 0x04, 0x06, 0x07]) {
      const payload = instance.multicodec
      payload[0] = header
      expect(() => JwkClass.fromMulticodec(payload)).toThrow('Invalid compressed public key header')
    }
  })

  it.each(okpFixtures)('does not interpret OKP payload bytes as SEC1 headers for $fixture.id', ({ JwkClass }) => {
    for (const header of [0x00, 0x02, 0x03, 0x04, 0xff]) {
      const payload = new Uint8Array(32)
      payload[0] = header
      expect(JwkClass.fromMulticodec(payload).multicodec).toEqual(payload)
    }

    expect(JwkClass.fromPublicKey(new Uint8Array(31)).multicodec).toHaveLength(31)
  })

  it('continues to reject RSA multicodec operations', () => {
    const instance = new RsaPublicJwk({ kty: 'RSA', n: 'AQ', e: 'AQAB' })

    expect(() => instance.multicodec).toThrow('multicodec not supported for RsaPublicJwk')
    expect(() => PublicJwk.fromPublicJwk(instance.jwk).fingerprint).toThrow('multicodec not supported for RsaPublicJwk')

    const fingerprint = MultiBaseEncoder.encode(new Uint8Array([...VarintEncoder.encode(0x1205), 0x01]), 'base58btc')
    expect(() => PublicJwk.fromFingerprint(fingerprint)).toThrow('fromMulticodec not supported for RsaPublicJwk')
  })
})
