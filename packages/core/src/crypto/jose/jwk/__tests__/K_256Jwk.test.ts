import { compressPublicKeyIfPossible } from 'ec-compression'

import { TypedArrayEncoder } from '../../../../utils'
import { KeyType } from '../../../KeyType'
import { K256Jwk } from '../K256Jwk'

// Generated with https://mkjwk.org
const jwkJson = {
  kty: 'EC',
  crv: 'secp256k1',
  x: '0CtFvFuEzkEhPOTKHi3k2OvEgJmQ1dH-IXXme3JBzVY',
  y: 'vIr8423MqTswmAebHhCaOoiYdp1kyOiduZinD3JBXxU',
}

const uncompressedPublicKey = new Uint8Array([
  0x04,
  ...TypedArrayEncoder.fromBase64(jwkJson.x),
  ...TypedArrayEncoder.fromBase64(jwkJson.y),
])
const compressedPublicKey = compressPublicKeyIfPossible(uncompressedPublicKey, 'k-256')

describe('K_256JWk', () => {
  test('has correct properties', () => {
    const jwk = new K256Jwk({ x: jwkJson.x, y: jwkJson.y })

    expect(jwk.kty).toEqual('EC')
    expect(jwk.crv).toEqual('secp256k1')
    expect(jwk.keyType).toEqual(KeyType.K256)
    expect(jwk.supportedEncryptionAlgorithms).toEqual([])
    expect(jwk.supportedSignatureAlgorithms).toEqual(['ES256K'])
    expect(jwk.key.keyType).toEqual(KeyType.K256)
    expect(jwk.toJson()).toEqual(jwkJson)

    expect(jwk.publicKey).toEqual(uncompressedPublicKey)
    expect(jwk.publicKey.length).toEqual(65)
    expect(jwk.publicKeyCompressed.length).toEqual(33)
  })

  test('fromJson', () => {
    const jwk = K256Jwk.fromJson(jwkJson)
    expect(jwk.x).toEqual(jwkJson.x)
    expect(jwk.y).toEqual(jwkJson.y)

    expect(() => K256Jwk.fromJson({ ...jwkJson, kty: 'test' })).toThrow("Invalid 'K-256' JWK.")
  })

  test('fromUncompressedPublicKey', () => {
    const jwk = K256Jwk.fromPublicKey(uncompressedPublicKey)
    expect(jwk.x).toEqual(jwkJson.x)
    expect(jwk.y).toEqual(jwkJson.y)
  })

  test('fromCompressedPublicKey', () => {
    const jwk = K256Jwk.fromPublicKey(compressedPublicKey)
    expect(jwk.x).toEqual(jwkJson.x)
    expect(jwk.y).toEqual(jwkJson.y)
  })
})
