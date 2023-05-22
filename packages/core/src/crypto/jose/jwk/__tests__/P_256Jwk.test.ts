import { TypedArrayEncoder, Buffer } from '../../../../utils'
import { KeyType } from '../../../KeyType'
import { P256Jwk } from '../P256Jwk'
import { compress } from '../ecCompression'

const jwkJson = {
  kty: 'EC',
  crv: 'P-256',
  x: 'igrFmi0whuihKnj9R3Om1SoMph72wUGeFaBbzG2vzns',
  y: 'efsX5b10x8yjyrj4ny3pGfLcY7Xby1KzgqOdqnsrJIM',
}

describe('P_256JWk', () => {
  test('has correct properties', () => {
    const jwk = new P256Jwk({ x: jwkJson.x, y: jwkJson.y })

    expect(jwk.kty).toEqual('EC')
    expect(jwk.crv).toEqual('P-256')
    expect(jwk.keyType).toEqual(KeyType.P256)

    const publicKeyBuffer = Buffer.concat([
      TypedArrayEncoder.fromBase64(jwkJson.x),
      TypedArrayEncoder.fromBase64(jwkJson.y),
    ])
    const compressedPublicKey = Buffer.from(compress(publicKeyBuffer))
    expect(jwk.publicKey).toEqual(compressedPublicKey)
    expect(jwk.supportedEncryptionAlgorithms).toEqual([])
    expect(jwk.supportedSignatureAlgorithms).toEqual(['ES256'])
    expect(jwk.key.keyType).toEqual(KeyType.P256)
    expect(jwk.toJson()).toEqual(jwkJson)
  })

  test('fromJson', () => {
    const jwk = P256Jwk.fromJson(jwkJson)
    expect(jwk.x).toEqual(jwkJson.x)
    expect(jwk.y).toEqual(jwkJson.y)

    expect(() => P256Jwk.fromJson({ ...jwkJson, kty: 'test' })).toThrowError("Invalid 'P-256' JWK.")
  })

  test('fromPublicKey', () => {
    const publicKeyBuffer = Buffer.concat([
      TypedArrayEncoder.fromBase64(jwkJson.x),
      TypedArrayEncoder.fromBase64(jwkJson.y),
    ])
    const compressedPublicKey = Buffer.from(compress(publicKeyBuffer))

    const jwk = P256Jwk.fromPublicKey(compressedPublicKey)
    expect(jwk.x).toEqual(jwkJson.x)
    expect(jwk.y).toEqual(jwkJson.y)
  })
})
