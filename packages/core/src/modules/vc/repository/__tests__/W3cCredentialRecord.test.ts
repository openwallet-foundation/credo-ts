import type { AnonCredsCredentialTags } from '../W3cCredentialRecord'

import { getAnonCredsTagsFromRecord } from '../../../../../../anoncreds/src/utils/w3cAnonCredsUtils'
import { JsonTransformer } from '../../../../utils'
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
        credential,
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
        contexts: credential.contexts,
        proofTypes: credential.proofTypes,
        givenId: credential.id,
        credentialDefinitionId: undefined,
        revocationRegistryId: undefined,
        schemaId: undefined,
        schemaIssuerId: undefined,
        schemaName: undefined,
        schemaVersion: undefined,
        expandedTypes: ['https://expanded.tag#1'],
        types: ['VerifiableCredential', 'UniversityDegreeCredential'],
      })

      expect(getAnonCredsTagsFromRecord(w3cCredentialRecord)).toBeUndefined()
    })

    it('should return default tags (w3cAnoncredsCredential)', () => {
      const credential = JsonTransformer.fromJSON(
        Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
        W3cJsonLdVerifiableCredential
      )

      const anoncredsCredentialRecordTags: AnonCredsCredentialTags = {
        anonCredsSchemaIssuerId: 'schemaIssuerId',
        anonCredsSchemaName: 'schemaName',
        anonCredsSchemaVersion: 'schemaVersion',
        anonCredsSchemaId: 'schemaId',
        anonCredsCredentialDefinitionId: 'credentialDefinitionId',
        anonCredsCredentialId: 'credentialId',
        anonCredsCredentialRevocationId: 'credentialRevocationId',
        anonCredsLinkSecretId: 'linkSecretId',
        anonCredsMethodName: 'methodName',
        anonCredsRevocationRegistryId: 'revocationRegistryId',
      }

      const w3cCredentialRecord = new W3cCredentialRecord({
        credential,
        tags: {
          expandedTypes: ['https://expanded.tag#1'],
        },
      })

      const anonCredsCredentialMetadata = {
        credentialId: anoncredsCredentialRecordTags.anonCredsCredentialId,
        credentialRevocationId: anoncredsCredentialRecordTags.anonCredsCredentialRevocationId,
        linkSecretId: anoncredsCredentialRecordTags.anonCredsLinkSecretId,
        methodName: anoncredsCredentialRecordTags.anonCredsMethodName,
      }

      w3cCredentialRecord.setTags(anoncredsCredentialRecordTags)
      w3cCredentialRecord.metadata.set('_w3c/AnonCredsMetadata', anonCredsCredentialMetadata)

      const anoncredsCredentialTags = {
        anonCredsLinkSecretId: 'linkSecretId',
        anonCredsMethodName: 'methodName',
        anonCredsSchemaId: 'schemaId',
        anonCredsSchemaIssuerId: 'schemaIssuerId',
        anonCredsSchemaName: 'schemaName',
        anonCredsSchemaVersion: 'schemaVersion',
        anonCredsCredentialDefinitionId: 'credentialDefinitionId',
        anonCredsCredentialId: 'credentialId',
        anonCredsRevocationRegistryId: 'revocationRegistryId',
        anonCredsCredentialRevocationId: 'credentialRevocationId',
      }

      const anonCredsTags = getAnonCredsTagsFromRecord(w3cCredentialRecord)
      expect(anonCredsTags).toEqual({
        ...anoncredsCredentialTags,
      })

      expect(w3cCredentialRecord.metadata.get('_w3c/AnonCredsMetadata')).toEqual(anonCredsCredentialMetadata)

      expect(w3cCredentialRecord.getTags()).toEqual({
        claimFormat: 'ldp_vc',
        issuerId: credential.issuerId,
        subjectIds: credential.credentialSubjectIds,
        schemaIds: credential.credentialSchemaIds,
        contexts: credential.contexts,
        proofTypes: credential.proofTypes,
        givenId: credential.id,
        types: ['VerifiableCredential', 'UniversityDegreeCredential'],
        cryptosuites: [],
        expandedTypes: ['https://expanded.tag#1'],
        ...anoncredsCredentialTags,
      })
    })
  })
})
