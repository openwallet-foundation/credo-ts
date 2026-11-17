import { TypedArrayEncoder } from '../../../utils/TypedArrayEncoder'
import { Hasher } from '../Hasher'

describe('Hasher', () => {
  afterEach(() => Hasher.setImplementation(undefined))

  test('uses the implementation set with setImplementation', () => {
    const implementation = vi.fn(() => new Uint8Array([1]))
    Hasher.setImplementation(implementation)

    expect(Hasher.hash('credo', 'SHA-256')).toEqual(new Uint8Array([1]))
    expect(implementation).toHaveBeenCalledWith(TypedArrayEncoder.fromUtf8String('credo'), 'sha-256')
  })

  test('throws for an unsupported hash name', () => {
    Hasher.setImplementation(vi.fn())

    expect(() => Hasher.hash('credo', 'md5')).toThrow("Hash name: 'md5' is not supported.")
    expect(() => Hasher.hash('credo', '__proto__')).toThrow("Hash name: '__proto__' is not supported.")
  })
})
