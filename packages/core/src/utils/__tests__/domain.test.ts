import { getDomainFromUrl } from '../domain'

describe('getDomainFromUrl', () => {
  test('returns the host name of an http(s) url', () => {
    expect(getDomainFromUrl('https://example.com')).toEqual('example.com')
    expect(getDomainFromUrl('https://example.com:8443/path?query=1#fragment')).toEqual('example.com')
    expect(getDomainFromUrl('http://sub.example.com/path')).toEqual('sub.example.com')
  })

  test('returns the host the url points to, not a look-alike in the path', () => {
    expect(getDomainFromUrl('https://evil.example\\good.example')).toEqual('evil.example')
  })

  test('throws for a url with userinfo', () => {
    expect(() => getDomainFromUrl('https://good.example:x@evil.example')).toThrow(
      'URL must not contain a username or password'
    )
    expect(() => getDomainFromUrl('https://good.example@evil.example')).toThrow(
      'URL must not contain a username or password'
    )
  })

  test('throws for a url without an http(s) scheme', () => {
    expect(() => getDomainFromUrl('ftp://example.com')).toThrow('URL must start with "https://"')
    expect(() => getDomainFromUrl('example.com')).toThrow("Invalid URL 'example.com'")
  })
})
