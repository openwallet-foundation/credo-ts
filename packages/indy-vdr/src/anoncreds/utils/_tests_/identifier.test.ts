import {
  getLegacySchemaId,
  getLegacyCredentialDefinitionId,
  didFromSchemaId,
  didFromCredentialDefinitionId,
  indyVdrAnonCredsRegistryIdentifierRegex,
} from '../identifiers'

describe('identifiers', () => {
  it('matches against a legacy indy did, schema id, credential definition id and revocation registry id', () => {
    const did = '7Tqg6BwSSWapxgUDm9KKgg'
    const schemaId = 'BQ42WeE24jFHeyGg8x9XAz:2:Medical Bill:1.0'
    const credentialDefinitionId = 'N7baRMcyvPwWc8v85CtZ6e:3:CL:100669:SCH Employee ID'
    const revocationRegistryId =
      'N7baRMcyvPwWc8v85CtZ6e:4:N7baRMcyvPwWc8v85CtZ6e:3:CL:100669:SCH Employee ID:CL_ACCUM:1-1024'

    const anotherId = 'some:id'

    expect(indyVdrAnonCredsRegistryIdentifierRegex.test(did)).toEqual(true)
    expect(indyVdrAnonCredsRegistryIdentifierRegex.test(schemaId)).toEqual(true)
    expect(indyVdrAnonCredsRegistryIdentifierRegex.test(credentialDefinitionId)).toEqual(true)
    expect(indyVdrAnonCredsRegistryIdentifierRegex.test(revocationRegistryId)).toEqual(true)
    expect(indyVdrAnonCredsRegistryIdentifierRegex.test(anotherId)).toEqual(false)
  })

  it('getLegacySchemaId should return a valid schema Id', () => {
    const did = '29347'
    const name = 'starlinks'
    const version = '321'

    expect(getLegacySchemaId(did, name, version)).toEqual(`29347:2:starlinks:321`)
  })

  it('getLegacyCredentialDefinition should return a valid Credential Id', () => {
    const did = '15565'
    const seqNo = 323
    const tag = 'indyTag'
    expect(getLegacyCredentialDefinitionId(did, seqNo, tag)).toEqual('15565:3:CL:323:indyTag')
  })

  it('didFromSchemaId should return the valid did from the schema', () => {
    const schemaId = '29347:2:starlinks:321'

    expect(didFromSchemaId(schemaId)).toEqual('29347')
  })

  it('didFromCredentialId should return the valid did from the schema', () => {
    const credentialDefinitionId = '15565:3:CL:323:indyTag'

    expect(didFromCredentialDefinitionId(credentialDefinitionId)).toEqual('15565')
  })
})
