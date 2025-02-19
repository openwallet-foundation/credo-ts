import { TypedArrayEncoder } from '../../../../utils'
import { KeyType } from '../../../KeyType'
import { X25519Jwk } from '../X25519Jwk'

const jwkJson = {
  kty: 'OKP',
  crv: 'X25519',
  x: 'W_Vcc7guviK-gPNDBmevVw-uJVamQV5rMNQGUwCqlH0',
}

describe('X25519JWk', () => {
  test('has correct properties', () => {
    const jwk = new X25519Jwk({ x: jwkJson.x })

    expect(jwk.kty).toEqual('OKP')
    expect(jwk.crv).toEqual('X25519')
    expect(jwk.keyType).toEqual(KeyType.X25519)
    expect(jwk.publicKey).toEqual(Uint8Array.from(TypedArrayEncoder.fromBase64(jwkJson.x)))
    expect(jwk.supportedEncryptionAlgorithms).toEqual(['ECDH-ES+A128KW', 'ECDH-ES+A192KW', 'ECDH-ES+A256KW', 'ECDH-ES'])
    expect(jwk.supportedSignatureAlgorithms).toEqual([])
    expect(jwk.key.keyType).toEqual(KeyType.X25519)
    expect(jwk.toJson()).toEqual(jwkJson)
  })

  test('fromJson', () => {
    const jwk = X25519Jwk.fromJson(jwkJson)
    expect(jwk.x).toEqual(jwkJson.x)

    expect(() => X25519Jwk.fromJson({ ...jwkJson, kty: 'test' })).toThrow("Invalid 'X25519' JWK.")
  })

  test('fromPublicKey', () => {
    const jwk = X25519Jwk.fromPublicKey(TypedArrayEncoder.fromBase64(jwkJson.x))
    expect(jwk.x).toEqual(jwkJson.x)
  })
})
