import { isSameDidReference, parseDidReference, toAbsoluteDidUrl, tryParseDid } from '../parse'

describe('DID URL parser', () => {
  it.each([
    'did:sov:abc;service=x',
    ...[' ', '|', '^', '[', ']'].flatMap((character) => [
      `did:example:123/${character}`,
      `did:example:123?key=${character}`,
      `did:example:123#${character}`,
    ]),
    'did:example:123#fragment#another',
    'did:example:123#fragment%zz',
  ])('rejects non-conformant DID URL %s', (did) => {
    expect(tryParseDid(did)).toBeNull()
  })

  it.each([
    'did:web:example.com%3A3000:user:alice',
    'did:webvh:QmYwAPJzv5CZsnAzt8auVTLZXNGq3kUu4uU3xk5f9v:example.com?versionId=1',
    'did:peer:2.Vz6Mkh1QZy3bBQp5KfHnZ7ZpHWHR3J1EXAMPLE#key-1',
    'did:cheqd:testnet:123e4567-e89b-12d3-a456-426614174000?resourceName=a&resourceType=b',
  ])('parses supported DID URL %s', (did) => {
    expect(tryParseDid(did)).not.toBeNull()
  })

  it('preserves empty query and fragment components', () => {
    expect(tryParseDid('did:example:123?')?.query).toBe('')
    expect(tryParseDid('did:example:123#')?.fragment).toBe('')
  })
})

const did = 'did:example:123'

describe('parseDidReference', () => {
  it.each([
    [did, undefined, { kind: 'did', did }],
    [`${did}#key-1`, undefined, { kind: 'verificationMethod', did, fragment: 'key-1' }],
    ['#key-1', did, { kind: 'verificationMethod', did, fragment: 'key-1' }],
    // A `?` after `#` is part of the fragment
    [`${did}#key-1?x`, undefined, { kind: 'verificationMethod', did, fragment: 'key-1?x' }],
  ])('parses %s (base %s)', (value, baseDid, expected) => {
    expect(parseDidReference(value, baseDid)).toEqual(expected)
  })

  it.each([
    ['a DID URL with a query', `${did}?versionId=1#key-1`, undefined],
    ['a DID URL with an empty query', `${did}?`, undefined],
    ['a DID URL with a path', `${did}/path#key-1`, undefined],
    ['a DID URL with an empty fragment', `${did}#`, undefined],
    ['a relative empty fragment', '#', did],
    ['a relative reference without a base DID', '#key-1', undefined],
    ['a relative reference against a base DID URL', '#key-1', `${did}#key-2`],
    ['a relative reference against a base DID with a query', '#key-1', `${did}?versionId=1`],
    ['a relative query', '?versionId=1#key-1', did],
    ['a relative path', '/path#key-1', did],
    ['a value that extends the base DID', ':456#key-1', did],
    ['a value that is not a DID', 'urn:uuid:1234', did],
  ])('rejects %s', (_, value, baseDid) => {
    expect(parseDidReference(value, baseDid)).toBeNull()
  })
})

describe('isSameDidReference', () => {
  it.each([
    [did, did, undefined, true],
    [`${did}#key-1`, `${did}#key-1`, undefined, true],
    [`${did}#key-1`, '#key-1', did, true],
    [`${did}#key-1`, `${did}#key-2`, undefined, false],
    [`${did}#key-1`, did, undefined, false],
    [`${did}#key-1`, 'did:example:456#key-1', undefined, false],
    [`${did}#key-1`, '#key-1', 'did:example:456', false],
    // Percent-encoding and case are left to the DID method, so they are not normalised
    [`${did}#key-1`, `${did}#key%2D1`, undefined, false],
    [`${did}#key-1`, `${did}#KEY-1`, undefined, false],
    [`${did}?versionId=1#key-1`, `${did}?versionId=1#key-1`, undefined, false],
    [`${did}/path#key-1`, `${did}/path#key-1`, undefined, false],
    [`${did}#`, `${did}#`, undefined, false],
  ])('%s and %s (base %s) are the same: %s', (a, b, baseDid, expected) => {
    expect(isSameDidReference(a, b, baseDid)).toBe(expected)
  })
})

describe('toAbsoluteDidUrl', () => {
  it.each([
    ['#key-1', `${did}#key-1`],
    ['#', `${did}#`],
    [`${did}#key-1`, `${did}#key-1`],
    ['did:example:456#key-1', 'did:example:456#key-1'],
    ['?service=x', '?service=x'],
    ['/path', '/path'],
    ['key-1', 'key-1'],
  ])('resolves %s to %s', (didUrl, expected) => {
    expect(toAbsoluteDidUrl(did, didUrl)).toBe(expected)
  })

  it('returns a relative reference unchanged when the base is not a bare DID', () => {
    expect(toAbsoluteDidUrl(`${did}?versionId=1`, '#key-1')).toBe('#key-1')
  })
})
