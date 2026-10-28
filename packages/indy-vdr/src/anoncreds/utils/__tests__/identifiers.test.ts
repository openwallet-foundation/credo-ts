import {
  getDidIndyCredentialDefinitionId,
  getDidIndyRevocationRegistryDefinitionId,
  getDidIndySchemaId,
  getIndyLedgerCredentialDefinitionId,
  getIndyLedgerRevocationRegistryDefinitionId,
  getIndyLedgerSchemaId,
  indyVdrAnonCredsRegistryIdentifierRegex,
} from '../identifiers'

describe('identifiers', () => {
  describe('indyVdrAnonCredsRegistryIdentifierRegex', () => {
    test('does not match against an unqualified did, schema id, credential definition id and revocation registry id', () => {
      const did = '7Tqg6BwSSWapxgUDm9KKgg'
      const schemaId = 'BQ42WeE24jFHeyGg8x9XAz:2:Medical Bill:1.0'
      const credentialDefinitionId = 'N7baRMcyvPwWc8v85CtZ6e:3:CL:100669:SCH Employee ID'
      const revocationRegistryId =
        'N7baRMcyvPwWc8v85CtZ6e:4:N7baRMcyvPwWc8v85CtZ6e:3:CL:100669:SCH Employee ID:CL_ACCUM:1-1024'

      const anotherId = 'some:id'

      expect(indyVdrAnonCredsRegistryIdentifierRegex.test(did)).toEqual(false)
      expect(indyVdrAnonCredsRegistryIdentifierRegex.test(schemaId)).toEqual(false)
      expect(indyVdrAnonCredsRegistryIdentifierRegex.test(credentialDefinitionId)).toEqual(false)
      expect(indyVdrAnonCredsRegistryIdentifierRegex.test(revocationRegistryId)).toEqual(false)
      expect(indyVdrAnonCredsRegistryIdentifierRegex.test(anotherId)).toEqual(false)
    })

    test('matches against a did indy did, schema id, credential definition id and revocation registry id', () => {
      const did = 'did:indy:local:7Tqg6BwSSWapxgUDm9KKgg'
      const schemaId = 'did:indy:local:BQ42WeE24jFHeyGg8x9XAz/anoncreds/v0/SCHEMA/Medical Bill/1.0'
      const credentialDefinitionId =
        'did:indy:local:N7baRMcyvPwWc8v85CtZ6e/anoncreds/v0/CLAIM_DEF/100669/SCH Employee ID'
      const revocationRegistryId =
        'did:indy:local:N7baRMcyvPwWc8v85CtZ6e/anoncreds/v0/REV_REG_DEF/100669/SCH Employee ID/1-1024'

      const anotherId = 'did:indy:local:N7baRMcyvPwWc8v85CtZ6e/anoncreds/v0/SOME_DEF'

      expect(indyVdrAnonCredsRegistryIdentifierRegex.test(did)).toEqual(true)
      expect(indyVdrAnonCredsRegistryIdentifierRegex.test(schemaId)).toEqual(true)
      expect(indyVdrAnonCredsRegistryIdentifierRegex.test(credentialDefinitionId)).toEqual(true)
      expect(indyVdrAnonCredsRegistryIdentifierRegex.test(revocationRegistryId)).toEqual(true)
      expect(indyVdrAnonCredsRegistryIdentifierRegex.test(anotherId)).toEqual(false)
    })
  })

  test('getDidIndySchemaId returns a valid schema id given a did, name, and version', () => {
    const namespace = 'sovrin:test'
    const did = '12345'
    const name = 'backbench'
    const version = '420'

    expect(getDidIndySchemaId(namespace, did, name, version)).toEqual(
      'did:indy:sovrin:test:12345/anoncreds/v0/SCHEMA/backbench/420'
    )
  })

  test('getDidIndyCredentialDefinitionId returns a valid credential definition id given a did, seqNo, and tag', () => {
    const namespace = 'sovrin:test'
    const did = '12345'
    const seqNo = 420
    const tag = 'someTag'

    expect(getDidIndyCredentialDefinitionId(namespace, did, seqNo, tag)).toEqual(
      'did:indy:sovrin:test:12345/anoncreds/v0/CLAIM_DEF/420/someTag'
    )
  })

  test('getDidIndyRevocationRegistryId returns a valid credential definition id given a did, seqNo, and tag', () => {
    const namespace = 'sovrin:test'
    const did = '12345'
    const seqNo = 420
    const credentialDefinitionTag = 'someTag'
    const tag = 'anotherTag'

    expect(getDidIndyRevocationRegistryDefinitionId(namespace, did, seqNo, credentialDefinitionTag, tag)).toEqual(
      'did:indy:sovrin:test:12345/anoncreds/v0/REV_REG_DEF/420/someTag/anotherTag'
    )
  })

  test('getIndyLedgerSchemaId returns the ledger schema id given a did, name, and version', () => {
    expect(getIndyLedgerSchemaId('12345', 'backbench', '420')).toEqual('12345:2:backbench:420')
  })

  test('getIndyLedgerCredentialDefinitionId returns the ledger credential definition id given a did, seqNo, and tag', () => {
    expect(getIndyLedgerCredentialDefinitionId('12345', 420, 'someTag')).toEqual('12345:3:CL:420:someTag')
  })

  test('getIndyLedgerRevocationRegistryDefinitionId returns the ledger revocation registry id given a did, seqNo, and tags', () => {
    expect(getIndyLedgerRevocationRegistryDefinitionId('12345', 420, 'someTag', 'anotherTag')).toEqual(
      '12345:4:12345:3:CL:420:someTag:CL_ACCUM:anotherTag'
    )
  })
})
