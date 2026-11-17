import { getTokenStatusListUri, parseTokenStatusListUri } from '../src'

const did = 'did:cheqd:testnet:0a5b94d0-a417-48ed-a6f5-4abc9e95888d'

describe('Token Status List uri', () => {
  it('builds the uri on the public resolver by default', () => {
    expect(getTokenStatusListUri({ did, name: 'revocation' })).toBe(
      `https://resolver.cheqd.net/1.0/identifiers/${did}?resourceName=revocation&resourceType=TokenStatusList`
    )
  })

  it('accepts a resolver url with or without a trailing slash', () => {
    const a = getTokenStatusListUri({ did, name: 'x', resolverUrl: 'https://resolver.example.com/1.0/identifiers' })
    const b = getTokenStatusListUri({ did, name: 'x', resolverUrl: 'https://resolver.example.com/1.0/identifiers/' })
    expect(a).toBe(b)
  })

  it('rejects a did that is not a did:cheqd did', () => {
    expect(() => getTokenStatusListUri({ did: 'did:web:example.com', name: 'x' })).toThrow()
  })

  it.each(['revocation', 'My List', 'a&b=c', 'percent%20sign', 'plus+sign', 'ünïcode', 'slash/name', 'a?b#c'])(
    'round trips the name %j through a resolver url and a did url',
    (name) => {
      const resolverUri = getTokenStatusListUri({ did, name })
      expect(parseTokenStatusListUri(resolverUri)).toEqual({ did, name })

      const didUrl = resolverUri.slice(resolverUri.indexOf('did:cheqd:'))
      expect(parseTokenStatusListUri(didUrl)).toEqual({ did, name })
    }
  )

  it.each([
    ['another http host', 'https://example.com/status/1'],
    [
      'a resolver url for another method',
      'https://resolver.cheqd.net/1.0/identifiers/did:web:example.com?resourceName=a&resourceType=TokenStatusList',
    ],
    ['another resource type', `${did}?resourceName=a&resourceType=StatusList2021Revocation`],
    ['a missing name', `${did}?resourceType=TokenStatusList`],
    ['a pinned version', `${did}?resourceName=a&resourceType=TokenStatusList&version=1`],
    ['a pinned time', `${did}?resourceName=a&resourceType=TokenStatusList&resourceVersionTime=1700000000`],
    ['no query', did],
    ['a malformed percent sequence', `${did}?resourceName=%E0%A4%A&resourceType=TokenStatusList`],
    ['an invalid did', 'did:cheqd:testnet:not-a-valid-id?resourceName=a&resourceType=TokenStatusList'],
  ])('does not read %s', (_name, uri) => {
    expect(parseTokenStatusListUri(uri)).toBeNull()
  })
})
