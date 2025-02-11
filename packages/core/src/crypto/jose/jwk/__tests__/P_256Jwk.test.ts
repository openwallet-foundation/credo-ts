import { compressPublicKeyIfPossible } from 'ec-compression'

import { TypedArrayEncoder } from '../../../../utils'
import { KeyType } from '../../../KeyType'
import { P256Jwk } from '../P256Jwk'

// Generated with https://mkjwk.org
const jwkJson = {
  kty: 'EC',
  crv: 'P-256',
  x: 'YKIJKqnGI22osL86OZUIGmwW7Bh0ZsUpTVBLVRNyThQ',
  y: 'booCsoNXVs1W8GBt9V7DvEktjyWPUV2NFvDrW2aqMfI',
}

const uncompressedPublicKey = new Uint8Array([
  0x04,
  ...TypedArrayEncoder.fromBase64(jwkJson.x),
  ...TypedArrayEncoder.fromBase64(jwkJson.y),
])
const compressedPublicKey = compressPublicKeyIfPossible(uncompressedPublicKey, 'p-256')

describe('P_256JWk', () => {
  test('has correct properties', () => {
    const jwk = new P256Jwk({ x: jwkJson.x, y: jwkJson.y })

    expect(jwk.kty).toEqual('EC')
    expect(jwk.crv).toEqual('P-256')
    expect(jwk.keyType).toEqual(KeyType.P256)
    expect(jwk.supportedEncryptionAlgorithms).toEqual([])
    expect(jwk.supportedSignatureAlgorithms).toEqual(['ES256'])
    expect(jwk.key.keyType).toEqual(KeyType.P256)
    expect(jwk.toJson()).toEqual(jwkJson)

    expect(jwk.publicKey).toEqual(uncompressedPublicKey)
    expect(jwk.publicKey.length).toEqual(65)
    expect(jwk.publicKeyCompressed.length).toEqual(33)
  })

  test('fromJson', () => {
    const jwk = P256Jwk.fromJson(jwkJson)
    expect(jwk.x).toEqual(jwkJson.x)
    expect(jwk.y).toEqual(jwkJson.y)

    expect(() => P256Jwk.fromJson({ ...jwkJson, kty: 'test' })).toThrow("Invalid 'P-256' JWK.")
  })

  test('fromUncompressedPublicKey', () => {
    const jwk = P256Jwk.fromPublicKey(uncompressedPublicKey)
    expect(jwk.x).toEqual(jwkJson.x)
    expect(jwk.y).toEqual(jwkJson.y)
  })

  test('fromCompressedPublicKey', () => {
    const jwk = P256Jwk.fromPublicKey(compressedPublicKey)
    expect(jwk.x).toEqual(jwkJson.x)
    expect(jwk.y).toEqual(jwkJson.y)
  })
})
