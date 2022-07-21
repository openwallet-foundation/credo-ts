import { JsonTransformer } from '../../../../utils'
import { Ed25519Signature2018Fixtures } from '../../__tests__/fixtures'
import { W3cVerifiableCredential } from '../../models'
import { W3cCredentialRecord } from '../W3cCredentialRecord'

describe('W3cCredentialRecord', () => {
  describe('getTags', () => {
    it('should return default tags', () => {
      const credential = JsonTransformer.fromJSON(
        Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
        W3cVerifiableCredential
      )

      const w3cCredentialRecord = new W3cCredentialRecord({
        credential,
        tags: {
          expandedTypes: ['https://expanded.tag#1'],
        },
      })

      expect(w3cCredentialRecord.getTags()).toEqual({
        issuerId: credential.issuerId,
        subjectIds: credential.credentialSubjectIds,
        schemaIds: credential.credentialSchemaIds,
        contexts: credential.contexts,
        proofTypes: credential.proofTypes,
        givenId: credential.id,
        expandedTypes: ['https://expanded.tag#1'],
      })
    })
  })
})
