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

  test('getIndyNamespaceFromIndyDid extracts the namespace of a bare DID', () => {
    expect(getIndyNamespaceFromIndyDid('did:indy:bcovrin:test:SDqTzbVuCowusqGBNbNDjH')).toBe('bcovrin:test')
    expect(getIndyNamespaceFromIndyDid('did:indy:sovrin:5nDyJVP1NrcPAttP3xwMB9')).toBe('sovrin')
  })

  test.each([
    '/anoncreds/v0/SCHEMA/schema-name/1.0',
    '/anoncreds/v0/CLAIM_DEF/10/TAG',
    '/anoncreds/v0/REV_REG_DEF/56495/npdb/TAG1',
    '/anoncreds/v0/SCHEMA/name',
    '/other-path',
    '?query=value',
    '#verkey',
  ])('getIndyNamespaceFromIndyDid rejects a DID URL with suffix %s', (suffix) => {
    const identifier = `did:indy:sovrin:5nDyJVP1NrcPAttP3xwMB9${suffix}`
    expect(() => getIndyNamespaceFromIndyDid(identifier)).toThrow(`${identifier} is not a valid did:indy did`)
  })

  test('getIndyNamespaceFromIndyDid rejects an unqualified identifier', () => {
    expect(() => getIndyNamespaceFromIndyDid('SDqTzbVuCowusqGBNbNDjH:2:schema-name:1.0')).toThrow(
      'SDqTzbVuCowusqGBNbNDjH:2:schema-name:1.0 is not a valid did:indy did'
    )
  })
})
