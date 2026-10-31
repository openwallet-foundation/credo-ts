import { TypedArrayEncoder } from '@credo-ts/core'

describe('subtleDigest', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('adds crypto.subtle.digest when it is missing', async () => {
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues })
    await import('../src/subtleDigest')

    // 'abc' inside a larger buffer, to check the view's offset is respected
    const data = TypedArrayEncoder.fromUtf8String('xabcx').subarray(1, 4)

    const sha256 = await globalThis.crypto.subtle.digest('SHA-256', data)
    expect(TypedArrayEncoder.toHex(new Uint8Array(sha256))).toEqual(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )

    const sha384 = await globalThis.crypto.subtle.digest({ name: 'SHA-384' }, data)
    expect(new Uint8Array(sha384).byteLength).toEqual(48)
  })

  it('keeps an existing crypto.subtle.digest', async () => {
    const digest = vi.fn()
    vi.stubGlobal('crypto', { subtle: { digest } })
    await import('../src/subtleDigest')

    expect(globalThis.crypto.subtle.digest).toBe(digest)
  })
})
