import type { Bls12381g1Jwk, Bls12381g2Jwk, Ed25519Jwk, P256Jwk, P384Jwk, P521Jwk, X25519Jwk } from '../JwkTypes'

import { getJwkFromKey, getKeyDataFromJwk } from '../Jwk'
import { Key } from '../Key'
import { KeyType } from '../KeyType'

describe('jwk', () => {
  it('Ed25519', () => {
    const fingerprint = 'z6MkiTBz1ymuepAQ4HEHYSF1H8quG5GLVVQR3djdX3mDooWp'
    const jwk = {
      kty: 'OKP',
      crv: 'Ed25519',
      x: 'O2onvM62pC1io6jQKm8Nc2UyFXcd4kOmOsBIoYtZ2ik',
    } satisfies Ed25519Jwk

    const { keyType, publicKey } = getKeyDataFromJwk(jwk)
    expect(keyType).toEqual(KeyType.Ed25519)
    expect(Key.fromPublicKey(publicKey, KeyType.Ed25519).fingerprint).toEqual(fingerprint)

    const actualJwk = getJwkFromKey(Key.fromFingerprint(fingerprint))
    expect(actualJwk).toEqual(jwk)
  })

  it('X25519', () => {
    const fingerprint = 'z6LShs9GGnqk85isEBzzshkuVWrVKsRp24GnDuHk8QWkARMW'
    const jwk = {
      kty: 'OKP',
      crv: 'X25519',
      x: 'W_Vcc7guviK-gPNDBmevVw-uJVamQV5rMNQGUwCqlH0',
    } satisfies X25519Jwk

    const { keyType, publicKey } = getKeyDataFromJwk(jwk)
    expect(keyType).toEqual(KeyType.X25519)
    expect(Key.fromPublicKey(publicKey, KeyType.X25519).fingerprint).toEqual(fingerprint)

    const actualJwk = getJwkFromKey(Key.fromFingerprint(fingerprint))
    expect(actualJwk).toEqual(jwk)
  })

  it('Bls12381G1', () => {
    const fingerprint = 'z3tEEysHYz5kkgpfDAByfDVgAuvtSFLHSqoMWmmSZBU1LZtN2sDsAS6RVQSevfxv39kyty'
    const jwk = {
      kty: 'EC',
      crv: 'Bls12381G1',
      x: 'im0OQGMTkh4YEhAl16hQwUQTcOaRqIqThqtSwksFK7WaH6Qywypmc3VIDyydmYTe',
    } satisfies Bls12381g1Jwk

    const { keyType, publicKey } = getKeyDataFromJwk(jwk)
    expect(keyType).toEqual(KeyType.Bls12381g1)
    expect(Key.fromPublicKey(publicKey, KeyType.Bls12381g1).fingerprint).toEqual(fingerprint)

    const actualJwk = getJwkFromKey(Key.fromFingerprint(fingerprint))
    expect(actualJwk).toEqual(jwk)
  })

  it('Bls12381G2', () => {
    const fingerprint =
      'zUC73gNPc1EnZmDDjYJzE8Bk89VRhuZPQYXFnSiSUZvX9N1i7N5VtMbJyowDR46rtARHLJYRVf7WMbGLb43s9tfTyKF9KFF22vBjXZRomcwtoQJmMNUSY7tfzyhLEy58dwUz3WD'
    const jwk = {
      crv: 'Bls12381G2',
      kty: 'EC',
      x: 'h_rkcTKXXzRbOPr9UxSfegCbid2U_cVNXQUaKeGF7UhwrMJFP70uMH0VQ9-3-_2zDPAAjflsdeLkOXW3-ShktLxuPy8UlXSNgKNmkfb-rrj-FRwbs13pv_WsIf-eV66-',
    } satisfies Bls12381g2Jwk

    const { keyType, publicKey } = getKeyDataFromJwk(jwk)
    expect(keyType).toEqual(KeyType.Bls12381g2)
    expect(Key.fromPublicKey(publicKey, KeyType.Bls12381g2).fingerprint).toEqual(fingerprint)

    const actualJwk = getJwkFromKey(Key.fromFingerprint(fingerprint))
    expect(actualJwk).toEqual(jwk)
  })

  it('P-256', () => {
    const fingerprint = 'zDnaerx9CtbPJ1q36T5Ln5wYt3MQYeGRG5ehnPAmxcf5mDZpv'
    const jwk = {
      kty: 'EC',
      crv: 'P-256',
      x: 'igrFmi0whuihKnj9R3Om1SoMph72wUGeFaBbzG2vzns',
      y: 'efsX5b10x8yjyrj4ny3pGfLcY7Xby1KzgqOdqnsrJIM',
    } satisfies P256Jwk

    const { keyType, publicKey } = getKeyDataFromJwk(jwk)
    expect(keyType).toEqual(KeyType.P256)
    expect(Key.fromPublicKey(publicKey, KeyType.P256).fingerprint).toEqual(fingerprint)

    const actualJwk = getJwkFromKey(Key.fromFingerprint(fingerprint))
    expect(actualJwk).toEqual(jwk)
  })

  it('P-384', () => {
    const fingerprint = 'z82Lm1MpAkeJcix9K8TMiLd5NMAhnwkjjCBeWHXyu3U4oT2MVJJKXkcVBgjGhnLBn2Kaau9'
    const jwk = {
      kty: 'EC',
      crv: 'P-384',
      x: 'lInTxl8fjLKp_UCrxI0WDklahi-7-_6JbtiHjiRvMvhedhKVdHBfi2HCY8t_QJyc',
      y: 'y6N1IC-2mXxHreETBW7K3mBcw0qGr3CWHCs-yl09yCQRLcyfGv7XhqAngHOu51Zv',
    } satisfies P384Jwk

    const { keyType, publicKey } = getKeyDataFromJwk(jwk)
    expect(keyType).toEqual(KeyType.P384)
    expect(Key.fromPublicKey(publicKey, KeyType.P384).fingerprint).toEqual(fingerprint)

    const actualJwk = getJwkFromKey(Key.fromFingerprint(fingerprint))
    expect(actualJwk).toEqual(jwk)
  })

  it('P-521', () => {
    const fingerprint =
      'z2J9gaYxrKVpdoG9A4gRnmpnRCcxU6agDtFVVBVdn1JedouoZN7SzcyREXXzWgt3gGiwpoHq7K68X4m32D8HgzG8wv3sY5j7'
    const jwk = {
      kty: 'EC',
      crv: 'P-521',
      x: 'ASUHPMyichQ0QbHZ9ofNx_l4y7luncn5feKLo3OpJ2nSbZoC7mffolj5uy7s6KSKXFmnNWxGJ42IOrjZ47qqwqyS',
      y: 'AW9ziIC4ZQQVSNmLlp59yYKrjRY0_VqO-GOIYQ9tYpPraBKUloEId6cI_vynCzlZWZtWpgOM3HPhYEgawQ703RjC',
    } satisfies P521Jwk

    const { keyType, publicKey } = getKeyDataFromJwk(jwk)
    expect(keyType).toEqual(KeyType.P521)
    expect(Key.fromPublicKey(publicKey, KeyType.P521).fingerprint).toEqual(fingerprint)

    const actualJwk = getJwkFromKey(Key.fromFingerprint(fingerprint))
    expect(actualJwk).toEqual(jwk)
  })
})
