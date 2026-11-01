import { tryParseDid } from '../parse'

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
