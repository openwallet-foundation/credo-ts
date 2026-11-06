import {
  getDidIndyCredentialDefinitionId,
  getDidIndyIdentifierVariants,
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

  test('getDidIndySchemaId percent-encodes the name when enabled', () => {
    expect(getDidIndySchemaId('sovrin:test', '12345', 'Medical Bill/%', '1.0', true)).toEqual(
      'did:indy:sovrin:test:12345/anoncreds/v0/SCHEMA/Medical%20Bill%2F%25/1.0'
    )
    expect(getDidIndySchemaId('sovrin:test', '12345', 'Medical Bill', '1.0')).toEqual(
      'did:indy:sovrin:test:12345/anoncreds/v0/SCHEMA/Medical Bill/1.0'
    )
  })

  test('getDidIndyCredentialDefinitionId percent-encodes the tag when enabled', () => {
    expect(getDidIndyCredentialDefinitionId('sovrin:test', '12345', 420, 'SCH Employee ID', true)).toEqual(
      'did:indy:sovrin:test:12345/anoncreds/v0/CLAIM_DEF/420/SCH%20Employee%20ID'
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

  test('getDidIndyRevocationRegistryDefinitionId percent-encodes the tags when enabled', () => {
    expect(
      getDidIndyRevocationRegistryDefinitionId('sovrin:test', '12345', 420, 'SCH Employee ID', '1/1024', true)
    ).toEqual('did:indy:sovrin:test:12345/anoncreds/v0/REV_REG_DEF/420/SCH%20Employee%20ID/1%2F1024')
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

  describe('getDidIndyIdentifierVariants', () => {
    const did = 'did:indy:sovrin:N7baRMcyvPwWc8v85CtZ6e'

    test('returns the percent-encoded form first, then the id as given and the unencoded form', () => {
      const encoded = `${did}/anoncreds/v0/REV_REG_DEF/100669/SCH%20Employee%20ID/1-1024`
      const unencoded = `${did}/anoncreds/v0/REV_REG_DEF/100669/SCH Employee ID/1-1024`

      expect(getDidIndyIdentifierVariants(encoded)).toEqual([encoded, unencoded])
      expect(getDidIndyIdentifierVariants(unencoded)).toEqual([encoded, unencoded])
      expect(getDidIndyIdentifierVariants(`${did}/anoncreds/v0/SCHEMA/Medical Bill/1.0`)).toEqual([
        `${did}/anoncreds/v0/SCHEMA/Medical%20Bill/1.0`,
        `${did}/anoncreds/v0/SCHEMA/Medical Bill/1.0`,
      ])
    })

    test('has the same canonical form for a slash in a tag, encoded with upper or lower case hex', () => {
      const canonical = `${did}/anoncreds/v0/CLAIM_DEF/10/a%2Fb`
      expect(getDidIndyIdentifierVariants(`${did}/anoncreds/v0/CLAIM_DEF/10/a/b`)).toEqual([
        canonical,
        `${did}/anoncreds/v0/CLAIM_DEF/10/a/b`,
      ])
      expect(getDidIndyIdentifierVariants(`${did}/anoncreds/v0/CLAIM_DEF/10/a%2fb`)).toEqual([
        canonical,
        `${did}/anoncreds/v0/CLAIM_DEF/10/a%2fb`,
        `${did}/anoncreds/v0/CLAIM_DEF/10/a/b`,
      ])
    })

    test('keeps an unencoded id with an invalid percent sequence and a partially encoded id', () => {
      expect(getDidIndyIdentifierVariants(`${did}/anoncreds/v0/SCHEMA/50% off/1.0`)).toEqual([
        `${did}/anoncreds/v0/SCHEMA/50%25%20off/1.0`,
        `${did}/anoncreds/v0/SCHEMA/50% off/1.0`,
      ])
      expect(getDidIndyIdentifierVariants(`${did}/anoncreds/v0/CLAIM_DEF/10/my%20big tag`)).toEqual([
        `${did}/anoncreds/v0/CLAIM_DEF/10/my%20big%20tag`,
        `${did}/anoncreds/v0/CLAIM_DEF/10/my%20big tag`,
        `${did}/anoncreds/v0/CLAIM_DEF/10/my big tag`,
      ])
    })

    test('returns an id without special characters, a did or a non did:indy id as is', () => {
      expect(getDidIndyIdentifierVariants(`${did}/anoncreds/v0/CLAIM_DEF/10/TAG`)).toEqual([
        `${did}/anoncreds/v0/CLAIM_DEF/10/TAG`,
      ])
      expect(getDidIndyIdentifierVariants(did)).toEqual([did])
      expect(getDidIndyIdentifierVariants('did:web:example.com:schema')).toEqual(['did:web:example.com:schema'])
    })
  })
})
