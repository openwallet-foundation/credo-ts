import { CredentialInfo } from '../models/CredentialInfo'

describe('CredentialInfo', () => {
  describe('getFormattedClaims()', () => {
    test('returns the claim names in title case', () => {
      const credentialInfo = new CredentialInfo({
        claims: {
          name: 'Timo',
          date_of_birth: '1998-07-29',
          'country-of-residence': 'The Netherlands',
          'street name': 'Test street',
          age: '22',
        },
        metadata: {
          credentialDefinitionId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
          schemaId: 'TL1EaPFCZ8Si5aUrqScBDt:2:test-schema-1599055118161:1.0',
        },
      })

      expect(credentialInfo.getFormattedClaims()).toEqual({
        Age: '22',
        'Country Of Residence': 'The Netherlands',
        'Date Of Birth': '1998-07-29',
        'Street Name': 'Test street',
        Name: 'Timo',
      })
    })
  })
})
