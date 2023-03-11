import {
  getDidIndyCredentialDefinitionId,
  getDidIndyRevocationRegistryId,
  getDidIndySchemaId,
  getLegacyCredentialDefinitionId,
  getLegacyRevocationRegistryId,
  getLegacySchemaId,
  indySdkAnonCredsRegistryIdentifierRegex,
  parseCredentialDefinitionId,
  parseRevocationRegistryId,
  parseSchemaId,
} from '../identifiers'

describe('identifiers', () => {
  describe('indySdkAnonCredsRegistryIdentifierRegex', () => {
    test('matches against a legacy schema id, credential definition id and revocation registry id', () => {
      const did = '7Tqg6BwSSWapxgUDm9KKgg'
      const schemaId = 'BQ42WeE24jFHeyGg8x9XAz:2:Medical Bill:1.0'
      const credentialDefinitionId = 'N7baRMcyvPwWc8v85CtZ6e:3:CL:100669:SCH Employee ID'
      const revocationRegistryId =
        'N7baRMcyvPwWc8v85CtZ6e:4:N7baRMcyvPwWc8v85CtZ6e:3:CL:100669:SCH Employee ID:CL_ACCUM:1-1024'

      const anotherId = 'some:id'

      // unqualified issuerId not in regex on purpose. See note in implementation.
      expect(indySdkAnonCredsRegistryIdentifierRegex.test(did)).toEqual(false)

      expect(indySdkAnonCredsRegistryIdentifierRegex.test(schemaId)).toEqual(true)
      expect(indySdkAnonCredsRegistryIdentifierRegex.test(credentialDefinitionId)).toEqual(true)
      expect(indySdkAnonCredsRegistryIdentifierRegex.test(revocationRegistryId)).toEqual(true)
      expect(indySdkAnonCredsRegistryIdentifierRegex.test(anotherId)).toEqual(false)
    })

    test('matches against a did indy did, schema id, credential definition id and revocation registry id', () => {
      const did = 'did:indy:local:7Tqg6BwSSWapxgUDm9KKgg'
      const schemaId = 'did:indy:local:BQ42WeE24jFHeyGg8x9XAz/anoncreds/v0/SCHEMA/Medical Bill/1.0'
      const credentialDefinitionId =
        'did:indy:local:N7baRMcyvPwWc8v85CtZ6e/anoncreds/v0/CLAIM_DEF/100669/SCH Employee ID'
      const revocationRegistryId =
        'did:indy:local:N7baRMcyvPwWc8v85CtZ6e/anoncreds/v0/REV_REG_DEF/100669/SCH Employee ID/1-1024'

      const anotherId = 'did:indy:local:N7baRMcyvPwWc8v85CtZ6e/anoncreds/v0/SOME_DEF'

      expect(indySdkAnonCredsRegistryIdentifierRegex.test(did)).toEqual(true)
      expect(indySdkAnonCredsRegistryIdentifierRegex.test(schemaId)).toEqual(true)
      expect(indySdkAnonCredsRegistryIdentifierRegex.test(credentialDefinitionId)).toEqual(true)
      expect(indySdkAnonCredsRegistryIdentifierRegex.test(revocationRegistryId)).toEqual(true)
      expect(indySdkAnonCredsRegistryIdentifierRegex.test(anotherId)).toEqual(false)
    })
  })

  test('getLegacySchemaId returns a valid schema id given a did, name, and version', () => {
    const did = '12345'
    const name = 'backbench'
    const version = '420'

    expect(getLegacySchemaId(did, name, version)).toEqual('12345:2:backbench:420')
  })

  test('getLegacyCredentialDefinitionId returns a valid credential definition id given a did, seqNo, and tag', () => {
    const did = '12345'
    const seqNo = 420
    const tag = 'someTag'

    expect(getLegacyCredentialDefinitionId(did, seqNo, tag)).toEqual('12345:3:CL:420:someTag')
  })

  test('getLegacyRevocationRegistryId returns a valid credential definition id given a did, seqNo, and tag', () => {
    const did = '12345'
    const seqNo = 420
    const credentialDefinitionTag = 'someTag'
    const tag = 'anotherTag'

    expect(getLegacyRevocationRegistryId(did, seqNo, credentialDefinitionTag, tag)).toEqual(
      '12345:4:12345:3:CL:420:someTag:CL_ACCUM:anotherTag'
    )
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

    expect(getDidIndyRevocationRegistryId(namespace, did, seqNo, credentialDefinitionTag, tag)).toEqual(
      'did:indy:sovrin:test:12345/anoncreds/v0/REV_REG_DEF/420/someTag/anotherTag'
    )
  })

  describe('parseSchemaId', () => {
    test('parses legacy schema id', () => {
      expect(parseSchemaId('SDqTzbVuCowusqGBNbNDjH:2:schema-name:1.0')).toEqual({
        did: 'SDqTzbVuCowusqGBNbNDjH',
        namespaceIdentifier: 'SDqTzbVuCowusqGBNbNDjH',
        schemaName: 'schema-name',
        schemaVersion: '1.0',
      })
    })

    test('parses did:indy schema id', () => {
      expect(parseSchemaId('did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH/anoncreds/v0/SCHEMA/schema-name/1.0')).toEqual(
        {
          namespaceIdentifier: 'SDqTzbVuCowusqGBNbNDjH',
          did: 'did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH',
          schemaName: 'schema-name',
          schemaVersion: '1.0',
          namespace: 'bcovrin:test',
        }
      )
    })
  })

  describe('parseCredentialDefinitionId', () => {
    test('parses legacy credential definition id', () => {
      expect(parseCredentialDefinitionId('TL1EaPFCZ8Si5aUrqScBDt:3:CL:10:TAG')).toEqual({
        did: 'TL1EaPFCZ8Si5aUrqScBDt',
        namespaceIdentifier: 'TL1EaPFCZ8Si5aUrqScBDt',
        schemaSeqNo: '10',
        tag: 'TAG',
      })
    })

    test('parses did:indy credential definition id', () => {
      expect(
        parseCredentialDefinitionId('did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt/anoncreds/v0/CLAIM_DEF/10/TAG')
      ).toEqual({
        namespaceIdentifier: 'TL1EaPFCZ8Si5aUrqScBDt',
        did: 'did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt',
        namespace: 'pool:localtest',
        schemaSeqNo: '10',
        tag: 'TAG',
      })
    })
  })

  describe('parseRevocationRegistryId', () => {
    test('parses legacy revocation registry id', () => {
      expect(
        parseRevocationRegistryId('5nDyJVP1NrcPAttP3xwMB9:4:5nDyJVP1NrcPAttP3xwMB9:3:CL:56495:npdb:CL_ACCUM:TAG1')
      ).toEqual({
        did: '5nDyJVP1NrcPAttP3xwMB9',
        namespaceIdentifier: '5nDyJVP1NrcPAttP3xwMB9',
        schemaSeqNo: '56495',
        credentialDefinitionTag: 'npdb',
        revocationRegistryTag: 'TAG1',
      })
    })

    test('parses did:indy revocation registry id', () => {
      expect(
        parseRevocationRegistryId('did:indy:sovrin:5nDyJVP1NrcPAttP3xwMB9/anoncreds/v0/REV_REG_DEF/56495/npdb/TAG1')
      ).toEqual({
        namespace: 'sovrin',
        namespaceIdentifier: '5nDyJVP1NrcPAttP3xwMB9',
        did: 'did:indy:sovrin:5nDyJVP1NrcPAttP3xwMB9',
        schemaSeqNo: '56495',
        credentialDefinitionTag: 'npdb',
        revocationRegistryTag: 'TAG1',
      })
    })
  })
})
