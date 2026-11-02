import {
  areDidIndyIdentifiersEqual,
  didIndyCredentialDefinitionIdRegex,
  didIndyIdentifierQuery,
  didIndyRegex,
  didIndyRevocationRegistryIdRegex,
  didIndySchemaIdRegex,
  getCanonicalDidIndyRestriction,
  getDidIndyIdentifierVariants,
  getIndyNamespaceFromIndyDid,
  parseIndyCredentialDefinitionId,
  parseIndyDid,
  parseIndyRevocationRegistryId,
  parseIndySchemaId,
  withDidIndyIdentifierQueryVariants,
  withDidIndyIdentifierVariantKeys,
  withDidIndyProofRequestRestrictionVariants,
  withDidIndyRestrictionVariants,
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

    test('decodes a percent-encoded schema name', () => {
      expect(
        parseIndySchemaId('did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH/anoncreds/v0/SCHEMA/Medical%20Bill%2F%25/1.0')
          .schemaName
      ).toEqual('Medical Bill/%')
    })

    test('parses a schema id created before names were percent-encoded', () => {
      expect(
        parseIndySchemaId('did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH/anoncreds/v0/SCHEMA/Medical Bill 100%/1.0')
          .schemaName
      ).toEqual('Medical Bill 100%')
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

    test('decodes a percent-encoded tag', () => {
      expect(
        parseIndyCredentialDefinitionId(
          'did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt/anoncreds/v0/CLAIM_DEF/10/SCH%20Employee%20ID'
        ).tag
      ).toEqual('SCH Employee ID')
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

    test('decodes percent-encoded tags', () => {
      expect(
        parseIndyRevocationRegistryId(
          'did:indy:sovrin:N7baRMcyvPwWc8v85CtZ6e/anoncreds/v0/REV_REG_DEF/100669/SCH%20Employee%20ID/1%2F1024'
        )
      ).toMatchObject({
        credentialDefinitionTag: 'SCH Employee ID',
        revocationRegistryTag: '1/1024',
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

  describe('getDidIndyIdentifierVariants', () => {
    test('returns the encoded and unencoded form of a did:indy id', () => {
      const did = 'did:indy:sovrin:N7baRMcyvPwWc8v85CtZ6e'
      const encoded = `${did}/anoncreds/v0/REV_REG_DEF/100669/SCH%20Employee%20ID/1-1024`
      const unencoded = `${did}/anoncreds/v0/REV_REG_DEF/100669/SCH Employee ID/1-1024`

      expect(getDidIndyIdentifierVariants(encoded)).toEqual([encoded, unencoded])
      expect(getDidIndyIdentifierVariants(unencoded)).toEqual([unencoded, encoded])
      expect(getDidIndyIdentifierVariants(`${did}/anoncreds/v0/SCHEMA/Medical%20Bill/1.0`)).toEqual([
        `${did}/anoncreds/v0/SCHEMA/Medical%20Bill/1.0`,
        `${did}/anoncreds/v0/SCHEMA/Medical Bill/1.0`,
      ])
    })

    test('returns an id without special characters or a non did:indy id as is', () => {
      expect(
        getDidIndyIdentifierVariants('did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt/anoncreds/v0/CLAIM_DEF/10/TAG')
      ).toEqual(['did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt/anoncreds/v0/CLAIM_DEF/10/TAG'])
      expect(getDidIndyIdentifierVariants('did:web:example.com:schema')).toEqual(['did:web:example.com:schema'])
    })
  })

  test('withDidIndyRestrictionVariants adds a restriction for each form of the ids', () => {
    const credentialDefinitionId = 'did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt/anoncreds/v0/CLAIM_DEF/10/my%20tag'

    expect(
      withDidIndyRestrictionVariants([{ cred_def_id: credentialDefinitionId, 'attr::name::value': 'John' }])
    ).toEqual([
      { cred_def_id: credentialDefinitionId, 'attr::name::value': 'John' },
      {
        cred_def_id: 'did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt/anoncreds/v0/CLAIM_DEF/10/my tag',
        'attr::name::value': 'John',
      },
    ])
    expect(withDidIndyRestrictionVariants([{ schema_name: 'test' }])).toEqual([{ schema_name: 'test' }])
  })

  describe('percent-encoded and unencoded did:indy ids', () => {
    const did = 'did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt'
    const encodedSchemaId = `${did}/anoncreds/v0/SCHEMA/My%20Schema/1.0`
    const unencodedSchemaId = `${did}/anoncreds/v0/SCHEMA/My Schema/1.0`
    const encodedCredentialDefinitionId = `${did}/anoncreds/v0/CLAIM_DEF/10/my%20tag`
    const unencodedCredentialDefinitionId = `${did}/anoncreds/v0/CLAIM_DEF/10/my tag`

    test('getDidIndyIdentifierVariants returns both forms of a tag with a slash', () => {
      expect(getDidIndyIdentifierVariants(`${did}/anoncreds/v0/CLAIM_DEF/10/a%2Fb`)).toEqual([
        `${did}/anoncreds/v0/CLAIM_DEF/10/a%2Fb`,
        `${did}/anoncreds/v0/CLAIM_DEF/10/a/b`,
      ])
      expect(getDidIndyIdentifierVariants(`${did}/anoncreds/v0/CLAIM_DEF/10/a/b`)).toEqual([
        `${did}/anoncreds/v0/CLAIM_DEF/10/a/b`,
        `${did}/anoncreds/v0/CLAIM_DEF/10/a%2Fb`,
      ])
    })

    test('getDidIndyIdentifierVariants keeps an unencoded id with an invalid percent sequence', () => {
      expect(getDidIndyIdentifierVariants(`${did}/anoncreds/v0/SCHEMA/50% off/1.0`)).toEqual([
        `${did}/anoncreds/v0/SCHEMA/50% off/1.0`,
        `${did}/anoncreds/v0/SCHEMA/50%25%20off/1.0`,
      ])
    })

    test('areDidIndyIdentifiersEqual', () => {
      expect(areDidIndyIdentifiersEqual(encodedSchemaId, unencodedSchemaId)).toBe(true)
      expect(areDidIndyIdentifiersEqual(unencodedCredentialDefinitionId, encodedCredentialDefinitionId)).toBe(true)
      expect(areDidIndyIdentifiersEqual(encodedSchemaId, encodedSchemaId)).toBe(true)
      expect(areDidIndyIdentifiersEqual(encodedSchemaId, `${did}/anoncreds/v0/SCHEMA/My%20Schema/2.0`)).toBe(false)
      expect(areDidIndyIdentifiersEqual('did:web:example.com', 'did:web:example.com')).toBe(true)
      expect(areDidIndyIdentifiersEqual('did:web:example.com', undefined)).toBe(false)
      expect(areDidIndyIdentifiersEqual(undefined, undefined)).toBe(true)
    })

    test('didIndyIdentifierQuery matches every form of a did:indy id', () => {
      expect(didIndyIdentifierQuery('schemaId', encodedSchemaId)).toEqual({
        $or: [{ schemaId: encodedSchemaId }, { schemaId: unencodedSchemaId }],
      })
      expect(didIndyIdentifierQuery('schemaId', 'did:web:example.com:schema')).toEqual({
        schemaId: 'did:web:example.com:schema',
      })
    })

    test('withDidIndyIdentifierQueryVariants replaces only the id tags that are set', () => {
      expect(
        withDidIndyIdentifierQueryVariants(
          { schemaId: unencodedSchemaId, credentialDefinitionId: undefined, issuerId: did },
          ['schemaId', 'credentialDefinitionId']
        )
      ).toEqual({
        $and: [
          { credentialDefinitionId: undefined, issuerId: did },
          { $or: [{ schemaId: unencodedSchemaId }, { schemaId: encodedSchemaId }] },
        ],
      })
      expect(withDidIndyIdentifierQueryVariants({ issuerId: did, schemaId: 'schemaId' }, ['schemaId'])).toEqual({
        issuerId: did,
        schemaId: 'schemaId',
      })
    })

    test('withDidIndyIdentifierVariantKeys adds every form of the keys without overwriting keys passed in', () => {
      expect(withDidIndyIdentifierVariantKeys({ [encodedSchemaId]: 1, 'did:web:example.com': 2 })).toEqual({
        [encodedSchemaId]: 1,
        [unencodedSchemaId]: 1,
        'did:web:example.com': 2,
      })
      expect(withDidIndyIdentifierVariantKeys({ [encodedSchemaId]: 1, [unencodedSchemaId]: 2 })).toEqual({
        [encodedSchemaId]: 1,
        [unencodedSchemaId]: 2,
      })
    })

    test('withDidIndyRestrictionVariants expands every combination of id forms', () => {
      expect(
        withDidIndyRestrictionVariants([
          { schema_id: encodedSchemaId, cred_def_id: encodedCredentialDefinitionId, schema_name: 'My Schema' },
        ])
      ).toEqual([
        { schema_id: encodedSchemaId, cred_def_id: encodedCredentialDefinitionId, schema_name: 'My Schema' },
        { schema_id: encodedSchemaId, cred_def_id: unencodedCredentialDefinitionId, schema_name: 'My Schema' },
        { schema_id: unencodedSchemaId, cred_def_id: encodedCredentialDefinitionId, schema_name: 'My Schema' },
        { schema_id: unencodedSchemaId, cred_def_id: unencodedCredentialDefinitionId, schema_name: 'My Schema' },
      ])
    })

    test('withDidIndyProofRequestRestrictionVariants expands attribute and predicate restrictions', () => {
      const proofRequest = withDidIndyProofRequestRestrictionVariants({
        name: 'proof',
        version: '1.0',
        nonce: '1',
        requested_attributes: {
          a: { name: 'name', restrictions: [{ cred_def_id: encodedCredentialDefinitionId }] },
          b: { name: 'other' },
        },
        requested_predicates: {
          p: { name: 'age', p_type: '>=', p_value: 18, restrictions: [{ schema_id: unencodedSchemaId }] },
        },
      })

      expect(proofRequest.requested_attributes.a.restrictions).toEqual([
        { cred_def_id: encodedCredentialDefinitionId },
        { cred_def_id: unencodedCredentialDefinitionId },
      ])
      expect(proofRequest.requested_attributes.b).toEqual({ name: 'other' })
      expect(proofRequest.requested_predicates.p.restrictions).toEqual([
        { schema_id: unencodedSchemaId },
        { schema_id: encodedSchemaId },
      ])
    })

    test('getCanonicalDidIndyRestriction percent-encodes the did:indy ids', () => {
      expect(
        getCanonicalDidIndyRestriction({
          cred_def_id: unencodedCredentialDefinitionId,
          issuer_id: did,
          schema_id: 'other',
        })
      ).toEqual({ cred_def_id: encodedCredentialDefinitionId, issuer_id: did, schema_id: 'other' })
    })
  })
})
