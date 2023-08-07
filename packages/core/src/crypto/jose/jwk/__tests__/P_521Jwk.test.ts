import { TypedArrayEncoder, Buffer } from '../../../../utils'
import { KeyType } from '../../../KeyType'
import { P521Jwk } from '../P521Jwk'
import { compress } from '../ecCompression'

const jwkJson = {
  kty: 'EC',
  crv: 'P-521',
  x: 'ASUHPMyichQ0QbHZ9ofNx_l4y7luncn5feKLo3OpJ2nSbZoC7mffolj5uy7s6KSKXFmnNWxGJ42IOrjZ47qqwqyS',
  y: 'AW9ziIC4ZQQVSNmLlp59yYKrjRY0_VqO-GOIYQ9tYpPraBKUloEId6cI_vynCzlZWZtWpgOM3HPhYEgawQ703RjC',
}

describe('P_521JWk', () => {
  test('has correct properties', () => {
    const jwk = new P521Jwk({ x: jwkJson.x, y: jwkJson.y })

    expect(jwk.kty).toEqual('EC')
    expect(jwk.crv).toEqual('P-521')
    expect(jwk.keyType).toEqual(KeyType.P521)
    const publicKeyBuffer = Buffer.concat([
      TypedArrayEncoder.fromBase64(jwkJson.x),
      TypedArrayEncoder.fromBase64(jwkJson.y),
    ])
    const compressedPublicKey = Buffer.from(compress(publicKeyBuffer))
    expect(jwk.publicKey).toEqual(compressedPublicKey)
    expect(jwk.supportedEncryptionAlgorithms).toEqual([])
    expect(jwk.supportedSignatureAlgorithms).toEqual(['ES512'])
    expect(jwk.key.keyType).toEqual(KeyType.P521)
    expect(jwk.toJson()).toEqual(jwkJson)
  })

  test('fromJson', () => {
    const jwk = P521Jwk.fromJson(jwkJson)
    expect(jwk.x).toEqual(jwkJson.x)
    expect(jwk.y).toEqual(jwkJson.y)

    expect(() => P521Jwk.fromJson({ ...jwkJson, kty: 'test' })).toThrowError("Invalid 'P-521' JWK.")
  })

  test('fromPublicKey', () => {
    const publicKeyBuffer = Buffer.concat([
      TypedArrayEncoder.fromBase64(jwkJson.x),
      TypedArrayEncoder.fromBase64(jwkJson.y),
    ])
    const compressedPublicKey = Buffer.from(compress(publicKeyBuffer))

    const jwk = P521Jwk.fromPublicKey(compressedPublicKey)
    expect(jwk.x).toEqual(jwkJson.x)
    expect(jwk.y).toEqual(jwkJson.y)
  })
})
