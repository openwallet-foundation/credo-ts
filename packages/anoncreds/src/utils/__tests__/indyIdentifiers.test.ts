import {
  didIndyCredentialDefinitionIdRegex,
  didIndyRegex,
  didIndyRevocationRegistryIdRegex,
  didIndySchemaIdRegex,
  getIndyNamespaceFromIndyDid,
  parseIndyCredentialDefinitionId,
  parseIndyDid,
  parseIndyRevocationRegistryId,
  parseIndySchemaId,
} from '../indyIdentifiers'

describe('did:indy identifiers', () => {
  const invalidTest = 'test'

  test('didIndyRegex matches a did:indy did and does not match an unqualified did', () => {
    expect('did:indy:sovrin:q7ATwTYbQDgiigVijUAej').toMatch(didIndyRegex)
    expect(didIndyRegex.test('q7ATwTYbQDgiigVijUAej')).toBe(false)
    expect(didIndyRegex.test('did:sov:q7ATwTYbQDgiigVijUAej')).toBe(false)
    expect(didIndyRegex.test(invalidTest)).toBe(false)
  })

  test('didIndySchemaIdRegex matches a did:indy schema id and does not match an unqualified schema id', () => {
    expect('did:indy:sovrin:q7ATwTYbQDgiigVijUAej/anoncreds/v0/SCHEMA/test/1.0').toMatch(didIndySchemaIdRegex)
    expect(didIndySchemaIdRegex.test('q7ATwTYbQDgiigVijUAej:2:test:1.0')).toBe(false)
    expect(didIndySchemaIdRegex.test(invalidTest)).toBe(false)
  })

  test('didIndyCredentialDefinitionIdRegex matches a did:indy credential definition id and does not match an unqualified credential definition id', () => {
    expect('did:indy:sovrin:q7ATwTYbQDgiigVijUAej/anoncreds/v0/CLAIM_DEF/160971/1.0.0').toMatch(
      didIndyCredentialDefinitionIdRegex
    )
    expect(didIndyCredentialDefinitionIdRegex.test('q7ATwTYbQDgiigVijUAej:3:CL:160971:1.0.0')).toBe(false)
    expect(didIndyCredentialDefinitionIdRegex.test(invalidTest)).toBe(false)
  })

  test('didIndyRevocationRegistryIdRegex matches a did:indy revocation registry id and does not match an unqualified revocation registry id', () => {
    expect('did:indy:sovrin:N7baRMcyvPwWc8v85CtZ6e/anoncreds/v0/REV_REG_DEF/100669/SCH Employee ID/1-1024').toMatch(
      didIndyRevocationRegistryIdRegex
    )
    expect(
      didIndyRevocationRegistryIdRegex.test(
        'N7baRMcyvPwWc8v85CtZ6e:4:N7baRMcyvPwWc8v85CtZ6e:3:CL:100669:SCH Employee ID:CL_ACCUM:1-1024'
      )
    ).toBe(false)
    expect(didIndyRevocationRegistryIdRegex.test(invalidTest)).toBe(false)
  })

  describe('parseIndyDid', () => {
    test('parses a did:indy did', () => {
      expect(parseIndyDid('did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH')).toEqual({
        namespace: 'bcovrin:test',
        namespaceIdentifier: 'SDqTzbVuCowusqGBNbNDjH',
      })
    })

    test('throws an error for an unqualified did', () => {
      expect(() => parseIndyDid('SDqTzbVuCowusqGBNbNDjH')).toThrow('SDqTzbVuCowusqGBNbNDjH is not a valid did:indy did')
    })
  })

  describe('parseIndySchemaId', () => {
    test('parses a did:indy schema id', () => {
      expect(
        parseIndySchemaId('did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH/anoncreds/v0/SCHEMA/schema-name/1.0')
      ).toEqual({
        namespaceIdentifier: 'SDqTzbVuCowusqGBNbNDjH',
        did: 'did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH',
        schemaName: 'schema-name',
        schemaVersion: '1.0',
        namespace: 'bcovrin:test',
      })
    })

    test('throws an error for an unqualified schema id', () => {
      expect(() => parseIndySchemaId('SDqTzbVuCowusqGBNbNDjH:2:schema-name:1.0')).toThrow(
        'Invalid did:indy schema id: SDqTzbVuCowusqGBNbNDjH:2:schema-name:1.0'
      )
    })
  })

  describe('parseIndyCredentialDefinitionId', () => {
    test('parses a did:indy credential definition id', () => {
      expect(
        parseIndyCredentialDefinitionId('did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt/anoncreds/v0/CLAIM_DEF/10/TAG')
      ).toEqual({
        namespaceIdentifier: 'TL1EaPFCZ8Si5aUrqScBDt',
        did: 'did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt',
        namespace: 'pool:localtest',
        schemaSeqNo: '10',
        tag: 'TAG',
      })
    })

    test('throws an error for an unqualified credential definition id', () => {
      expect(() => parseIndyCredentialDefinitionId('TL1EaPFCZ8Si5aUrqScBDt:3:CL:10:TAG')).toThrow(
        'Invalid did:indy credential definition id: TL1EaPFCZ8Si5aUrqScBDt:3:CL:10:TAG'
      )
    })
  })

  describe('parseIndyRevocationRegistryId', () => {
    test('parses a did:indy revocation registry id', () => {
      expect(
        parseIndyRevocationRegistryId('did:indy:sovrin:5nDyJVP1NrcPAttP3xwMB9/anoncreds/v0/REV_REG_DEF/56495/npdb/TAG1')
      ).toEqual({
        namespace: 'sovrin',
        namespaceIdentifier: '5nDyJVP1NrcPAttP3xwMB9',
        did: 'did:indy:sovrin:5nDyJVP1NrcPAttP3xwMB9',
        schemaSeqNo: '56495',
        credentialDefinitionTag: 'npdb',
        revocationRegistryTag: 'TAG1',
      })
    })

    test('throws an error for an unqualified revocation registry id', () => {
      expect(() =>
        parseIndyRevocationRegistryId('5nDyJVP1NrcPAttP3xwMB9:4:5nDyJVP1NrcPAttP3xwMB9:3:CL:56495:npdb:CL_ACCUM:TAG1')
      ).toThrow(
        'Invalid did:indy revocation registry id: 5nDyJVP1NrcPAttP3xwMB9:4:5nDyJVP1NrcPAttP3xwMB9:3:CL:56495:npdb:CL_ACCUM:TAG1'
      )
    })
  })

  describe('getIndyNamespaceFromIndyDid', () => {
    test('returns the namespace of a did, schema id, credential definition id and revocation registry id', () => {
      expect(getIndyNamespaceFromIndyDid('did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH')).toEqual('bcovrin:test')
      expect(
        getIndyNamespaceFromIndyDid('did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH/anoncreds/v0/SCHEMA/schema-name/1.0')
      ).toEqual('bcovrin:test')
      expect(
        getIndyNamespaceFromIndyDid('did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt/anoncreds/v0/CLAIM_DEF/10/TAG')
      ).toEqual('pool:localtest')
      expect(
        getIndyNamespaceFromIndyDid('did:indy:sovrin:5nDyJVP1NrcPAttP3xwMB9/anoncreds/v0/REV_REG_DEF/56495/npdb/TAG1')
      ).toEqual('sovrin')
    })

    test('throws an error for an unqualified identifier', () => {
      expect(() => getIndyNamespaceFromIndyDid('SDqTzbVuCowusqGBNbNDjH:2:schema-name:1.0')).toThrow(
        'SDqTzbVuCowusqGBNbNDjH:2:schema-name:1.0 is not a valid did:indy did'
      )
    })
  })
})
