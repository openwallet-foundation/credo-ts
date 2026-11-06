import { MultiBaseEncoder, TypedArrayEncoder, VarintEncoder } from '../../../../../utils'
import { PublicJwk } from '../../../../kms'

import didKeyEd25519 from '../../../__tests__/__fixtures__/didKeyEd25519.json'
import didKeyK256 from '../../../__tests__/__fixtures__/didKeyK256.json'
import didKeyP256 from '../../../__tests__/__fixtures__/didKeyP256.json'
import didKeyP384 from '../../../__tests__/__fixtures__/didKeyP384.json'
import didKeyP521 from '../../../__tests__/__fixtures__/didKeyP521.json'
import didKeyX25519 from '../../../__tests__/__fixtures__/didKeyX25519.json'
import { DidKey } from '../DidKey'

const keyFixtures = [didKeyX25519, didKeyEd25519, didKeyP256, didKeyP384, didKeyP521, didKeyK256]

describe('DidKey', () => {
  it('creates a DidKey instance from a did', async () => {
    for (const documentType of keyFixtures) {
      const didKey = DidKey.fromDid(documentType.id)

      expect(didKey.did).toBe(documentType.id)
      expect(didKey.didDocument.toJSON()).toMatchObject(documentType)
    }
  })

  it.each(keyFixtures)('rejects invalid key lengths for $id', ({ id }) => {
    const { data } = MultiBaseEncoder.decode(id.slice('did:key:'.length))
    const [, prefixLength] = VarintEncoder.decode(data)

    for (const payload of [data.slice(0, prefixLength), data.slice(0, -1), new Uint8Array([...data, 0])]) {
      const fingerprint = MultiBaseEncoder.encode(payload, 'base58btc')
      expect(() => DidKey.fromDid(`did:key:${fingerprint}`)).toThrow('Invalid public key length')
    }
  })

  it.each([didKeyK256, didKeyP256, didKeyP384, didKeyP521])(
    'rejects uncompressed EC fingerprints without changing public key imports for $id',
    ({ id }) => {
      const key = DidKey.fromDid(id).publicJwk
      const publicKey = key.publicKey
      if (publicKey.kty !== 'EC') throw new Error('Expected an EC fixture')
      expect(PublicJwk.fromPublicKey(publicKey).fingerprint).toBe(key.fingerprint)

      const uncompressed = TypedArrayEncoder.concat([
        VarintEncoder.encode(key.JwkClass.multicodecPrefix),
        publicKey.publicKey,
      ])
      expect(() => PublicJwk.fromFingerprint(MultiBaseEncoder.encode(uncompressed, 'base58btc'))).toThrow(
        'Invalid public key length'
      )

      const { data } = MultiBaseEncoder.decode(key.fingerprint)
      const [, prefixLength] = VarintEncoder.decode(data)
      for (const header of [0x00, 0x04, 0x06, 0x07]) {
        const invalidHeader = data.slice()
        invalidHeader[prefixLength] = header
        expect(() => PublicJwk.fromFingerprint(MultiBaseEncoder.encode(invalidHeader, 'base58btc'))).toThrow(
          'Invalid compressed public key header'
        )
      }
    }
  )

  it.each([
    ['truncated', [0x80], 'truncated'],
    ['non-minimal', [0xed, 0x81, 0x00, ...new Uint8Array(32)], 'not minimal'],
    ['unsafe', [0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x10], 'maximum safe integer'],
    ['unknown', [0x01, ...new Uint8Array(32)], 'Unsupported multicodec'],
  ] as const)('rejects %s multicodec prefixes', (_name, bytes, message) => {
    const fingerprint = MultiBaseEncoder.encode(new Uint8Array(bytes), 'base58btc')
    expect(() => DidKey.fromDid(`did:key:${fingerprint}`)).toThrow(message)
  })

  it('rejects base64url multibase fingerprints', () => {
    const { data } = MultiBaseEncoder.decode(didKeyEd25519.id.slice('did:key:'.length))
    const fingerprint = `u${TypedArrayEncoder.toBase64Url(data)}`
    expect(() => PublicJwk.fromFingerprint(fingerprint)).toThrow("No decoder found for multibase prefix 'u'")
    expect(() => DidKey.fromDid(`did:key:${fingerprint}`)).toThrow("No decoder found for multibase prefix 'u'")
  })

  it('creates a DidKey instance from a key instance', async () => {
    const key = PublicJwk.fromPublicKey({
      kty: 'OKP',
      crv: 'X25519',
      publicKey: TypedArrayEncoder.fromBase58(didKeyX25519.keyAgreement[0].publicKeyBase58),
    })
    const didKey = new DidKey(key)

    expect(didKey.did).toBe(didKeyX25519.id)
    expect(didKey.didDocument.toJSON()).toMatchObject(didKeyX25519)
  })
})
