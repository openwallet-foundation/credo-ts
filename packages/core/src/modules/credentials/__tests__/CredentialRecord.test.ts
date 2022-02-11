import { CredentialPreviewAttribute } from '../CredentialPreviewAttributes'
import { CredentialState } from '../CredentialState'
import { CredentialExchangeRecord } from '../repository/CredentialRecord'
import { CredentialMetadataKeys } from '../repository/credentialMetadataTypes'

describe('CredentialRecord', () => {
  describe('getCredentialInfo()', () => {
    test('creates credential info object from credential record data', () => {
      const credentialRecord = new CredentialExchangeRecord({
        connectionId: '28790bfe-1345-4c64-b21a-7d98982b3894',
        threadId: 'threadId',
        state: CredentialState.Done,
        credentialAttributes: [
          new CredentialPreviewAttribute({
            name: 'age',
            value: '25',
          }),
        ],
      })

      credentialRecord.metadata.set(CredentialMetadataKeys.IndyCredential, {
        credentialDefinitionId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
        schemaId: 'TL1EaPFCZ8Si5aUrqScBDt:2:test-schema-1599055118161:1.0',
      })

      const credentialInfo = credentialRecord.getCredentialInfo()

      expect(credentialInfo).toEqual({
        claims: {
          age: '25',
        },
        metadata: {
          '_internal/indyCredential': {
            credentialDefinitionId: 'Th7MpTaRZVRYnPiabds81Y:3:CL:17:TAG',
            schemaId: 'TL1EaPFCZ8Si5aUrqScBDt:2:test-schema-1599055118161:1.0',
          },
        },
      })
    })
  })
})
