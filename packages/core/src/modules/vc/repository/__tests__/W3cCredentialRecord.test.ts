import type { AnonCredsCredentialRecordOptions } from '../W3cCredentialRecord'

import { JsonTransformer } from '../../../../utils'
import { Ed25519Signature2018Fixtures } from '../../data-integrity/__tests__/fixtures'
import { W3cJsonLdVerifiableCredential } from '../../data-integrity/models'
import { W3cCredentialSubject } from '../../models'
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

      expect(w3cCredentialRecord.getAnonCredsTags()).toBeUndefined()
    })

    it('should return default tags (w3cAnoncredsCredential)', () => {
      const credential = JsonTransformer.fromJSON(
        Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
        W3cJsonLdVerifiableCredential
      )

      const anonCredsCredentialRecordOptions: AnonCredsCredentialRecordOptions = {
        schemaIssuerId: 'schemaIssuerId',
        schemaName: 'schemaName',
        schemaVersion: 'schemaVersion',
        schemaId: 'schemaId',
        credentialDefinitionId: 'credentialDefinitionId',
        credentialId: 'credentialId',
        credentialRevocationId: 'credentialRevocationId',
        linkSecretId: 'linkSecretId',
        methodName: 'methodName',
        revocationRegistryId: 'revocationRegistryId',
      }

      if (Array.isArray(credential.credentialSubject)) throw new Error('Invalid credentialSubject')
      credential.credentialSubject = new W3cCredentialSubject({ claims: { degree: 'Bachelor of Science and Arts' } })
      const w3cCredentialRecord = new W3cCredentialRecord({
        credential,
        tags: {
          expandedTypes: ['https://expanded.tag#1'],
        },
        anonCredsCredentialRecordOptions,
      })

      const anoncredsCredentialTags = {
        linkSecretId: 'linkSecretId',
        methodName: 'methodName',
        schemaId: 'schemaId',
        schemaIssuerId: 'schemaIssuerId',
        schemaName: 'schemaName',
        schemaVersion: 'schemaVersion',
        credentialDefinitionId: 'credentialDefinitionId',
        credentialId: 'credentialId',
        'attr::degree::marker': true,
        'attr::degree::value': 'Bachelor of Science and Arts',
        revocationRegistryId: 'revocationRegistryId',
        credentialRevocationId: 'credentialRevocationId',
        unqualifiedCredentialDefinitionId: undefined,
        unqualifiedIssuerId: undefined,
        unqualifiedRevocationRegistryId: undefined,
        unqualifiedSchemaId: undefined,
        unqualifiedSchemaIssuerId: undefined,
      }

      const anonCredsTags = w3cCredentialRecord.getAnonCredsTags()
      expect(anonCredsTags).toEqual({
        ...anoncredsCredentialTags,
      })

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
