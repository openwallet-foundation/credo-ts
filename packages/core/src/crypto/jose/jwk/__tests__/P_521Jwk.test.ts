import { compressPublicKeyIfPossible } from 'ec-compression'

import { TypedArrayEncoder } from '../../../../utils'
import { KeyType } from '../../../KeyType'
import { P521Jwk } from '../P521Jwk'

// Generated with https://mkjwk.org
const jwkJson = {
  kty: 'EC',
  crv: 'P-521',
  x: 'AAyV8qWafv5UPexMB3ohAPSFuz_zFdaHAjb-XlzO8qBkx-lZtN1PN1E9AHipP6esSNBPilGOAkiZYnQ48hPJgJQG',
  y: 'AccbmJnVXJhxJ8vFS4GcG1eM27XtSOjKz1dX52wbJ0YN6U5KEOPQ-3krxvLAqlFG2BCbZkpnrfateEdervmp3Q3G',
}

const uncompressedPublicKey = new Uint8Array([
  0x04,
  ...TypedArrayEncoder.fromBase64(jwkJson.x),
  ...TypedArrayEncoder.fromBase64(jwkJson.y),
])
const compressedPublicKey = compressPublicKeyIfPossible(uncompressedPublicKey, 'p-521')

describe('P_521JWk', () => {
  test('has correct properties', () => {
    const jwk = new P521Jwk({ x: jwkJson.x, y: jwkJson.y })

    expect(jwk.kty).toEqual('EC')
    expect(jwk.crv).toEqual('P-521')
    expect(jwk.keyType).toEqual(KeyType.P521)
    expect(jwk.supportedEncryptionAlgorithms).toEqual([])
    expect(jwk.supportedSignatureAlgorithms).toEqual(['ES512'])
    expect(jwk.key.keyType).toEqual(KeyType.P521)
    expect(jwk.toJson()).toEqual(jwkJson)

    expect(jwk.publicKey).toEqual(uncompressedPublicKey)
    expect(jwk.publicKey.length).toEqual(133)
    expect(jwk.publicKeyCompressed.length).toEqual(67)
  })

  test('fromJson', () => {
    const jwk = P521Jwk.fromJson(jwkJson)
    expect(jwk.x).toEqual(jwkJson.x)
    expect(jwk.y).toEqual(jwkJson.y)

    expect(() => P521Jwk.fromJson({ ...jwkJson, kty: 'test' })).toThrow("Invalid 'P-521' JWK.")
  })

  test('fromUncompressedPublicKey', () => {
    const jwk = P521Jwk.fromPublicKey(uncompressedPublicKey)
    expect(jwk.x).toEqual(jwkJson.x)
    expect(jwk.y).toEqual(jwkJson.y)
  })

  test('fromCompressedPublicKey', () => {
    const jwk = P521Jwk.fromPublicKey(compressedPublicKey)
    expect(jwk.x).toEqual(jwkJson.x)
    expect(jwk.y).toEqual(jwkJson.y)
  })
})
