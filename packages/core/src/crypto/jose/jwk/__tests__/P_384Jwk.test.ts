import { TypedArrayEncoder, Buffer } from '../../../../utils'
import { KeyType } from '../../../KeyType'
import { P384Jwk } from '../P384Jwk'
import { compress } from '../ecCompression'

const jwkJson = {
  kty: 'EC',
  crv: 'P-384',
  x: 'lInTxl8fjLKp_UCrxI0WDklahi-7-_6JbtiHjiRvMvhedhKVdHBfi2HCY8t_QJyc',
  y: 'y6N1IC-2mXxHreETBW7K3mBcw0qGr3CWHCs-yl09yCQRLcyfGv7XhqAngHOu51Zv',
}

describe('P_384JWk', () => {
  test('has correct properties', () => {
    const jwk = new P384Jwk({ x: jwkJson.x, y: jwkJson.y })

    expect(jwk.kty).toEqual('EC')
    expect(jwk.crv).toEqual('P-384')
    expect(jwk.keyType).toEqual(KeyType.P384)
    const publicKeyBuffer = Buffer.concat([
      TypedArrayEncoder.fromBase64(jwkJson.x),
      TypedArrayEncoder.fromBase64(jwkJson.y),
    ])
    const compressedPublicKey = Buffer.from(compress(publicKeyBuffer))
    expect(jwk.publicKey).toEqual(compressedPublicKey)
    expect(jwk.supportedEncryptionAlgorithms).toEqual([])
    expect(jwk.supportedSignatureAlgorithms).toEqual(['ES384'])
    expect(jwk.key.keyType).toEqual(KeyType.P384)
    expect(jwk.toJson()).toEqual(jwkJson)
  })

  test('fromJson', () => {
    const jwk = P384Jwk.fromJson(jwkJson)
    expect(jwk.x).toEqual(jwkJson.x)
    expect(jwk.y).toEqual(jwkJson.y)

    expect(() => P384Jwk.fromJson({ ...jwkJson, kty: 'test' })).toThrowError("Invalid 'P-384' JWK.")
  })

  test('fromPublicKey', () => {
    const publicKeyBuffer = Buffer.concat([
      TypedArrayEncoder.fromBase64(jwkJson.x),
      TypedArrayEncoder.fromBase64(jwkJson.y),
    ])
    const compressedPublicKey = Buffer.from(compress(publicKeyBuffer))

    const jwk = P384Jwk.fromPublicKey(compressedPublicKey)
    expect(jwk.x).toEqual(jwkJson.x)
    expect(jwk.y).toEqual(jwkJson.y)
  })
})
