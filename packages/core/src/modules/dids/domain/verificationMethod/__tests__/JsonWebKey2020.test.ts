import { PublicJwk } from '../../../../kms'
import { getJsonWebKey2020 } from '../JsonWebKey2020'

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
})
