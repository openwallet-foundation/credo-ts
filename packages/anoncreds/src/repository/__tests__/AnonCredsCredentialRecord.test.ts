import type { AnonCredsCredential } from '@aries-framework/anoncreds'

import { AnonCredsCredentialRecord } from '../AnonCredsCredentialRecord'

describe('AnoncredsCredentialRecords', () => {
  test('Returns the correct tags from the getTags methods based on the credential record values', () => {
    const anoncredsCredentialRecords = new AnonCredsCredentialRecord({
      credential: {
        cred_def_id: 'credDefId',
        schema_id: 'schemaId',
        signature: 'signature',
        signature_correctness_proof: 'signatureCorrectnessProof',
        values: { attr1: { raw: 'value1', encoded: 'encvalue1' }, attr2: { raw: 'value2', encoded: 'encvalue2' } },
        rev_reg_id: 'revRegId',
      } as AnonCredsCredential,
      credentialId: 'myCredentialId',
      credentialRevocationId: 'credentialRevocationId',
      linkSecretId: 'linkSecretId',
      issuerId: 'issuerDid',
      schemaIssuerId: 'schemaIssuerDid',
      schemaName: 'schemaName',
      schemaVersion: 'schemaVersion',
      methodName: 'methodName',
    })

    const tags = anoncredsCredentialRecords.getTags()

    expect(tags).toMatchObject({
      issuerId: 'issuerDid',
      schemaIssuerId: 'schemaIssuerDid',
      schemaName: 'schemaName',
      schemaVersion: 'schemaVersion',
      credentialDefinitionId: 'credDefId',
      schemaId: 'schemaId',
      credentialId: 'myCredentialId',
      credentialRevocationId: 'credentialRevocationId',
      linkSecretId: 'linkSecretId',
      'attr::attr1::value': 'value1',
      'attr::attr1::marker': true,
      'attr::attr2::value': 'value2',
      'attr::attr2::marker': true,
      methodName: 'methodName',
    })
  })
})
