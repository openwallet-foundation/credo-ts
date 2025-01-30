import { TypedArrayEncoder } from '../../../../utils'
import { KeyType } from '../../../KeyType'
import { P384Jwk } from '../P384Jwk'
import { compress } from '../ecCompression'

// Generated with https://mkjwk.org
const jwkJson = {
  kty: 'EC',
  crv: 'P-384',
  x: 'Rl0BbVOvE0zcytPVSGgM39tihXnlYjuaLin3SjhD6cLRL_IK-3tHTCljCiJBbSX9',
  y: '282rUQMBuCkLb0t9PbReApadoP7Jo-sVcZDNGglYg4iMsqNPvyq-WIzxSUb1USpc',
}

const uncompressedPublicKey = new Uint8Array([
  0x04,
  ...TypedArrayEncoder.fromBase64(jwkJson.x),
  ...TypedArrayEncoder.fromBase64(jwkJson.y),
])
const compressedPublicKey = compress(uncompressedPublicKey)

describe('P_384JWk', () => {
  test('has correct properties', () => {
    const jwk = new P384Jwk({ x: jwkJson.x, y: jwkJson.y })

    expect(jwk.kty).toEqual('EC')
    expect(jwk.crv).toEqual('P-384')
    expect(jwk.keyType).toEqual(KeyType.P384)
    expect(jwk.supportedEncryptionAlgorithms).toEqual([])
    expect(jwk.supportedSignatureAlgorithms).toEqual(['ES384'])
    expect(jwk.key.keyType).toEqual(KeyType.P384)
    expect(jwk.toJson()).toEqual(jwkJson)

    expect(jwk.publicKey).toEqual(uncompressedPublicKey)
    expect(jwk.publicKey.length).toEqual(97)
    expect(jwk.publicKeyCompressed.length).toEqual(49)
  })

  test('fromJson', () => {
    const jwk = P384Jwk.fromJson(jwkJson)
    expect(jwk.x).toEqual(jwkJson.x)
    expect(jwk.y).toEqual(jwkJson.y)

    expect(() => P384Jwk.fromJson({ ...jwkJson, kty: 'test' })).toThrow("Invalid 'P-384' JWK.")
  })

  test('fromUncompressedPublicKey', () => {
    const jwk = P384Jwk.fromPublicKey(uncompressedPublicKey)
    expect(jwk.x).toEqual(jwkJson.x)
    expect(jwk.y).toEqual(jwkJson.y)
  })

  test('fromCompressedPublicKey', () => {
    const jwk = P384Jwk.fromPublicKey(compressedPublicKey)
    expect(jwk.x).toEqual(jwkJson.x)
    expect(jwk.y).toEqual(jwkJson.y)
  })
})
