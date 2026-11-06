import { uuidFromName } from '../uuid'

describe('uuidFromName', () => {
  const dnsNamespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

  test('matches the name-based UUIDv8 example from RFC 9562 appendix B.2', () => {
    expect(uuidFromName('www.example.com', dnsNamespace)).toBe('5c146b14-3c52-8afd-938a-375d0df1fbf6')
  })

  test('sets version 8 and variant 10', () => {
    // These names hash to all four raw variant bit patterns
    for (const name of ['a', 'c', 'g', 'h']) {
      expect(uuidFromName(name, dnsNamespace)).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      )
    }
  })
})
