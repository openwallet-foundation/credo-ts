import { TypedArrayEncoder } from '@credo-ts/core'
import { decodeBase64OrBase64Url } from '../src/dids/didCheqdUtil'

// These bytes encode with '+' and '/' in base64 and with '-' and '_' in base64url
const bytes = new Uint8Array([0xfb, 0xff, 0xbe, 0xfb, 0xef])

describe('decodeBase64OrBase64Url', () => {
  test('decodes standard base64', () => {
    const encoded = TypedArrayEncoder.toBase64(bytes)
    expect(encoded).toMatch(/[+/]/)
    expect(decodeBase64OrBase64Url(encoded)).toEqual(bytes)
  })

  test('decodes base64url without padding, as returned by renderResourceData', () => {
    const encoded = TypedArrayEncoder.toBase64Url(bytes)
    expect(encoded).toMatch(/[-_]/)
    expect(decodeBase64OrBase64Url(encoded)).toEqual(bytes)
  })

  test('decodes strings that are valid in both alphabets identically', () => {
    const plain = new Uint8Array([1, 2, 3])
    expect(decodeBase64OrBase64Url(TypedArrayEncoder.toBase64(plain))).toEqual(plain)
    expect(decodeBase64OrBase64Url(TypedArrayEncoder.toBase64Url(plain))).toEqual(plain)
  })

  test('throws on text that is neither', () => {
    expect(() => decodeBase64OrBase64Url('not base64 !!')).toThrow()
  })

  test('the previous behaviour (fromBase64 only) rejects base64url, which is why the fallback exists', () => {
    expect(() => TypedArrayEncoder.fromBase64(TypedArrayEncoder.toBase64Url(bytes))).toThrow()
  })
})
