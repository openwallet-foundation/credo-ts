import { TypedArrayEncoder } from '@credo-ts/core'

// The polyfill adds globalThis.crypto when it's missing, which polyfillCrypto stands in for
async function importSubtleDigest(polyfillCrypto?: Pick<typeof globalThis.crypto, 'getRandomValues'>) {
  vi.doMock('react-native-get-random-values', () => {
    if (polyfillCrypto) vi.stubGlobal('crypto', polyfillCrypto)
    return {}
  })
  await import('../src/subtleDigest')
}

describe('subtleDigest', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('adds crypto.subtle.digest when it is missing', async () => {
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues })
    await importSubtleDigest()

    // 'abc' inside a larger buffer, to check the view's offset is respected
    const data = TypedArrayEncoder.fromUtf8String('xabcx').subarray(1, 4)

    const sha256 = await globalThis.crypto.subtle.digest('SHA-256', data)
    expect(TypedArrayEncoder.toHex(new Uint8Array(sha256))).toEqual(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    )

    const sha384 = await globalThis.crypto.subtle.digest({ name: 'SHA-384' }, data)
    expect(new Uint8Array(sha384).byteLength).toEqual(48)
  })

  it('loads the crypto polyfill before it adds crypto.subtle.digest', async () => {
    const getRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto)
    vi.stubGlobal('crypto', undefined)
    await importSubtleDigest({ getRandomValues })

    expect(globalThis.crypto.subtle.digest).toBeTypeOf('function')
  })

  it('keeps an existing crypto.subtle.digest', async () => {
    const digest = vi.fn()
    vi.stubGlobal('crypto', { subtle: { digest } })
    await importSubtleDigest()

    expect(globalThis.crypto.subtle.digest).toBe(digest)
  })
})
