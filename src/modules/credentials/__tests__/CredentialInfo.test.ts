import { CredentialInfo } from '../models/CredentialInfo'

describe('CredentialInfo', () => {
  it('should return the correct property values', () => {
    const claims = {
      name: 'Timo',
      date_of_birth: '1998-07-29',
      'country-of-residence': 'The Netherlands',
      'street name': 'Test street',
      age: '22',
    }
    const metadata = {
      credentialDefinitionId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
      schemaId: 'TL1EaPFCZ8Si5aUrqScBDt:2:test-schema-1599055118161:1.0',
    }
    const credentialInfo = new CredentialInfo({
      claims,
      metadata,
    })

    expect(credentialInfo.claims).toEqual(claims)
    expect(credentialInfo.metadata).toEqual(metadata)
  })
})
