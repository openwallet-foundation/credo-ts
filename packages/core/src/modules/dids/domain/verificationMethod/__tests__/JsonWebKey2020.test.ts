import { PublicJwk } from '../../../../kms'
import { getJsonWebKey2020, getPublicJwkFromJsonWebKey2020, isJsonWebKey2020 } from '../JsonWebKey2020'

describe('getJsonWebKey2020', () => {
  it('does not include the jwk kid in the verification method', () => {
    const publicJwk = PublicJwk.fromUnknown({
      kty: 'EC',
      crv: 'P-256',
      x: 'acbIQiuMs3i8_uszEjJ2tpTtRM4EU3yz91PH6CdH2V0',
      y: '_KcyLj9vWMptnmKtm46GqDz8wf74I5LKgrl2GzH3nSE',
      kid: 'local-kms-key-id',
    })

    const verificationMethod = getJsonWebKey2020({ did: 'did:example:123', publicJwk })

    expect(verificationMethod.publicKeyJwk).toEqual({
      kty: 'EC',
      crv: 'P-256',
      x: 'acbIQiuMs3i8_uszEjJ2tpTtRM4EU3yz91PH6CdH2V0',
      y: '_KcyLj9vWMptnmKtm46GqDz8wf74I5LKgrl2GzH3nSE',
    })
    expect(publicJwk.keyId).toBe('local-kms-key-id')
  })

  it('preserves public key values when converting a did:key fingerprint to JsonWebKey2020', () => {
    const fingerprint = 'zDnaerx9CtbPJ1q36T5Ln5wYt3MQYeGRG5ehnPAmxcf5mDZpv'
    const did = `did:key:${fingerprint}`
    const publicJwk = PublicJwk.fromFingerprint(fingerprint)
    const verificationMethod = getJsonWebKey2020({ did, publicJwk })
    if (!isJsonWebKey2020(verificationMethod)) throw new Error('Expected a JsonWebKey2020 verification method')

    expect(verificationMethod.id).toBe(`${did}#${fingerprint}`)
    expect(verificationMethod.publicKeyJwk).toEqual(publicJwk.toJson({ includeKid: false }))
    expect(verificationMethod.publicKeyJwk).not.toHaveProperty('d')
    expect(getPublicJwkFromJsonWebKey2020(verificationMethod).fingerprint).toBe(fingerprint)
  })
})
