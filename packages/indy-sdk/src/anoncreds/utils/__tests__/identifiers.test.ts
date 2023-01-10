import {
  didFromSchemaId,
  didFromCredentialDefinitionId,
  didFromRevocationRegistryDefinitionId,
  getIndySeqNoFromUnqualifiedCredentialDefinitionId,
  getLegacyCredentialDefinitionId,
  getLegacySchemaId,
} from '../identifiers'

describe('identifiers', () => {
  it('getLegacySchemaId should return a valid schema id given a did, name, and version', () => {
    const did = '12345'
    const name = 'backbench'
    const version = '420'

    expect(getLegacySchemaId(did, name, version)).toEqual('12345:2:backbench:420')
  })

  it('getLegacyCredentialDefinitionId should return a valid credential definition id given a did, seqNo, and tag', () => {
    const did = '12345'
    const seqNo = 420
    const tag = 'someTag'

    expect(getLegacyCredentialDefinitionId(did, seqNo, tag)).toEqual('12345:3:CL:420:someTag')
  })

  it('getIndySeqNoFromUnqualifiedCredentialDefinitionId should return the seqNo from the credential definition id', () => {
    expect(getIndySeqNoFromUnqualifiedCredentialDefinitionId('12345:3:CL:420:someTag')).toEqual(420)
  })

  it('didFromSchemaId should return the did from the schema id', () => {
    const schemaId = '12345:2:backbench:420'

    expect(didFromSchemaId(schemaId)).toEqual('12345')
  })

  it('didFromCredentialDefinitionId should return the did from the credential definition id', () => {
    const credentialDefinitionId = '12345:3:CL:420:someTag'

    expect(didFromCredentialDefinitionId(credentialDefinitionId)).toEqual('12345')
  })

  it('didFromRevocationRegistryDefinitionId should return the did from the revocation registry id', () => {
    const revocationRegistryId = '12345:3:CL:420:someTag'

    expect(didFromRevocationRegistryDefinitionId(revocationRegistryId)).toEqual('12345')
  })
})
