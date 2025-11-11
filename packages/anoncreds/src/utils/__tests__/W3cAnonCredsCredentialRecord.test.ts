import { JsonTransformer, W3cCredentialRecord, W3cJsonLdVerifiableCredential } from '@credo-ts/core'

import { Ed25519Signature2018Fixtures } from '../../../../core/src/modules/vc/data-integrity/__tests__/fixtures'
import { W3cAnonCredsCredentialMetadataKey } from '../metadata'
import { type AnonCredsCredentialTags, getAnonCredsTagsFromRecord } from '../w3cAnonCredsUtils'

describe('AnoncredsW3cCredentialRecord', () => {
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
      anonCredsCredentialRevocationId: 'credentialRevocationId',
      anonCredsLinkSecretId: 'linkSecretId',
      anonCredsMethodName: 'methodName',
      anonCredsRevocationRegistryId: 'revocationRegistryId',
    }

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

    const anonCredsCredentialMetadata = {
      credentialRevocationId: anoncredsCredentialRecordTags.anonCredsCredentialRevocationId,
      linkSecretId: anoncredsCredentialRecordTags.anonCredsLinkSecretId,
      methodName: anoncredsCredentialRecordTags.anonCredsMethodName,
    }

    w3cCredentialRecord.setTags(anoncredsCredentialRecordTags)
    w3cCredentialRecord.metadata.set(W3cAnonCredsCredentialMetadataKey, anonCredsCredentialMetadata)

    const anoncredsCredentialTags = {
      anonCredsLinkSecretId: 'linkSecretId',
      anonCredsMethodName: 'methodName',
      anonCredsSchemaId: 'schemaId',
      anonCredsSchemaIssuerId: 'schemaIssuerId',
      anonCredsSchemaName: 'schemaName',
      anonCredsSchemaVersion: 'schemaVersion',
      anonCredsCredentialDefinitionId: 'credentialDefinitionId',
      anonCredsRevocationRegistryId: 'revocationRegistryId',
      anonCredsCredentialRevocationId: 'credentialRevocationId',
    }

    const anonCredsTags = getAnonCredsTagsFromRecord(w3cCredentialRecord)
    expect(anonCredsTags).toEqual({
      ...anoncredsCredentialTags,
    })

    expect(w3cCredentialRecord.metadata.get(W3cAnonCredsCredentialMetadataKey)).toEqual(anonCredsCredentialMetadata)

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
