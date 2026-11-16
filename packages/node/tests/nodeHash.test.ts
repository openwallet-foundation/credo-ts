import { Hasher, Sha1, Sha256, Sha384, Sha512, TypedArrayEncoder } from '@credo-ts/core'

import { nodeHash } from '../src/nodeHash'

describe('nodeHash', () => {
  test.each([
    ['sha-1', new Sha1()],
    ['sha-256', new Sha256()],
    ['sha-384', new Sha384()],
    ['sha-512', new Sha512()],
  ] as const)('%s matches the JavaScript implementation', (hashName, jsHash) => {
    const data = TypedArrayEncoder.fromUtf8String('credo')
    const hash = nodeHash(data, hashName)

    // Strict, so a Buffer instead of a plain Uint8Array fails
    expect(hash).toStrictEqual(jsHash.hash(data))
    expect(hash.buffer.byteLength).toBe(hash.byteLength)
  })

  test('is set as the hash implementation when importing @credo-ts/node', async () => {
    const setImplementation = vi.spyOn(Hasher, 'setImplementation')
    await import('../src')

    expect(setImplementation).toHaveBeenCalledWith(nodeHash)
  })
})
