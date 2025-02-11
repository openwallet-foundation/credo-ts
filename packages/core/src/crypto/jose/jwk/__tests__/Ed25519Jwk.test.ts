import { TypedArrayEncoder } from '../../../../utils'
import { KeyType } from '../../../KeyType'
import { Ed25519Jwk } from '../Ed25519Jwk'

const jwkJson = {
  kty: 'OKP',
  crv: 'Ed25519',
  x: 'O2onvM62pC1io6jQKm8Nc2UyFXcd4kOmOsBIoYtZ2ik',
}

describe('Ed25519JWk', () => {
  test('has correct properties', () => {
    const jwk = new Ed25519Jwk({ x: jwkJson.x })

    expect(jwk.kty).toEqual('OKP')
    expect(jwk.crv).toEqual('Ed25519')
    expect(jwk.keyType).toEqual(KeyType.Ed25519)
    expect(jwk.publicKey).toEqual(Uint8Array.from(TypedArrayEncoder.fromBase64(jwkJson.x)))
    expect(jwk.supportedEncryptionAlgorithms).toEqual([])
    expect(jwk.supportedSignatureAlgorithms).toEqual(['EdDSA'])
    expect(jwk.key.keyType).toEqual(KeyType.Ed25519)
    expect(jwk.toJson()).toEqual(jwkJson)
  })

  test('fromJson', () => {
    const jwk = Ed25519Jwk.fromJson(jwkJson)
    expect(jwk.x).toEqual(jwkJson.x)

    expect(() => Ed25519Jwk.fromJson({ ...jwkJson, kty: 'test' })).toThrow("Invalid 'Ed25519' JWK.")
  })

  test('fromPublicKey', () => {
    const jwk = Ed25519Jwk.fromPublicKey(TypedArrayEncoder.fromBase64(jwkJson.x))
    expect(jwk.x).toEqual(jwkJson.x)
  })
})
