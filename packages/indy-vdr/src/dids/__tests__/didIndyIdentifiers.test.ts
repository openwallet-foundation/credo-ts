import { didIndyRegex, getIndyNamespaceFromIndyDid, isIndyDid, parseIndyDid } from '../didIndyUtil'

describe('did:indy identifiers', () => {
  test('didIndyRegex matches a did:indy DID and not an unqualified DID', () => {
    expect('did:indy:sovrin:q7ATwTYbQDgiigVijUAej').toMatch(didIndyRegex)
    expect(didIndyRegex.test('q7ATwTYbQDgiigVijUAej')).toBe(false)
    expect(didIndyRegex.test('did:sov:q7ATwTYbQDgiigVijUAej')).toBe(false)
    expect(didIndyRegex.test('test')).toBe(false)
  })

  test('isIndyDid checks the did:indy prefix', () => {
    expect(isIndyDid('did:indy:sovrin:q7ATwTYbQDgiigVijUAej')).toBe(true)
    expect(isIndyDid('did:sov:q7ATwTYbQDgiigVijUAej')).toBe(false)
  })

  test('parseIndyDid extracts the namespace and namespace identifier', () => {
    expect(parseIndyDid('did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH')).toEqual({
      namespace: 'bcovrin:test',
      namespaceIdentifier: 'SDqTzbVuCowusqGBNbNDjH',
    })
    expect(() => parseIndyDid('SDqTzbVuCowusqGBNbNDjH')).toThrow('SDqTzbVuCowusqGBNbNDjH is not a valid did:indy did')
  })

  test('getIndyNamespaceFromIndyDid accepts DID and AnonCreds object identifiers', () => {
    expect(getIndyNamespaceFromIndyDid('did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH')).toBe('bcovrin:test')
    expect(
      getIndyNamespaceFromIndyDid('did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH/anoncreds/v0/SCHEMA/schema-name/1.0')
    ).toBe('bcovrin:test')
    expect(
      getIndyNamespaceFromIndyDid('did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt/anoncreds/v0/CLAIM_DEF/10/TAG')
    ).toBe('pool:localtest')
    expect(
      getIndyNamespaceFromIndyDid('did:indy:sovrin:5nDyJVP1NrcPAttP3xwMB9/anoncreds/v0/REV_REG_DEF/56495/npdb/TAG1')
    ).toBe('sovrin')
    expect(() => getIndyNamespaceFromIndyDid('SDqTzbVuCowusqGBNbNDjH:2:schema-name:1.0')).toThrow(
      'SDqTzbVuCowusqGBNbNDjH:2:schema-name:1.0 is not a valid did:indy did'
    )
    expect(() =>
      getIndyNamespaceFromIndyDid('did:indy:sovrin:5nDyJVP1NrcPAttP3xwMB9/anoncreds/v0/SCHEMA/name')
    ).toThrow('is not a valid did:indy did')
  })
})
