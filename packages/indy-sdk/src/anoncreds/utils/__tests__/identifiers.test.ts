import {
  didFromSchemaId,
  didFromCredentialDefinitionId,
  didFromRevocationRegistryDefinitionId,
  getIndySeqNoFromUnqualifiedCredentialDefinitionId,
  getLegacyCredentialDefinitionId,
  getLegacySchemaId,
  indySdkAnonCredsRegistryIdentifierRegex,
} from '../identifiers'

describe('identifiers', () => {
  it('matches against a legacy indy did, schema id, credential definition id and revocation registry id', () => {
    const did = '7Tqg6BwSSWapxgUDm9KKgg'
    const schemaId = 'BQ42WeE24jFHeyGg8x9XAz:2:Medical Bill:1.0'
    const credentialDefinitionId = 'N7baRMcyvPwWc8v85CtZ6e:3:CL:100669:SCH Employee ID'
    const revocationRegistryId =
      'N7baRMcyvPwWc8v85CtZ6e:4:N7baRMcyvPwWc8v85CtZ6e:3:CL:100669:SCH Employee ID:CL_ACCUM:1-1024'

    const anotherId = 'some:id'

    expect(indySdkAnonCredsRegistryIdentifierRegex.test(did)).toEqual(true)
    expect(indySdkAnonCredsRegistryIdentifierRegex.test(schemaId)).toEqual(true)
    expect(indySdkAnonCredsRegistryIdentifierRegex.test(credentialDefinitionId)).toEqual(true)
    expect(indySdkAnonCredsRegistryIdentifierRegex.test(revocationRegistryId)).toEqual(true)
    expect(indySdkAnonCredsRegistryIdentifierRegex.test(anotherId)).toEqual(false)
  })

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
