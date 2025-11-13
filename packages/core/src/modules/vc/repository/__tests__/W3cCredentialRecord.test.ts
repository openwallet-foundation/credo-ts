import { getAnonCredsTagsFromRecord } from '../../../../../../anoncreds/src/utils/w3cAnonCredsUtils'
import { JsonTransformer } from '../../../../utils'
import { CredentialMultiInstanceState } from '../../../../utils/credentialUseTypes'
import { Ed25519Signature2018Fixtures } from '../../data-integrity/__tests__/fixtures'
import { W3cJsonLdVerifiableCredential } from '../../data-integrity/models'
import { W3cCredentialRecord } from '../W3cCredentialRecord'

describe('W3cCredentialRecord', () => {
  describe('getTags', () => {
    it('should return default tags (w3c credential)', () => {
      const credential = JsonTransformer.fromJSON(
        Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
        W3cJsonLdVerifiableCredential
      )

      const w3cCredentialRecord = new W3cCredentialRecord({
        credentialInstances: [
          {
            credential: credential.jsonCredential,
          },
        ],
        tags: {
          expandedTypes: ['https://expanded.tag#1'],
        },
      })

      expect(w3cCredentialRecord.getTags()).toEqual({
        claimFormat: 'ldp_vc',
        issuerId: credential.issuerId,
        subjectIds: credential.credentialSubjectIds,
        cryptosuites: [],
        schemaIds: credential.credentialSchemaIds,
        multiInstanceState: CredentialMultiInstanceState.SingleInstanceUnused,
        contexts: credential.contexts,
        proofTypes: credential.proofTypes,
        givenId: credential.id,
        expandedTypes: ['https://expanded.tag#1'],
        types: ['VerifiableCredential', 'UniversityDegreeCredential'],
      })

      expect(getAnonCredsTagsFromRecord(w3cCredentialRecord)).toBeUndefined()
    })
  })
})
