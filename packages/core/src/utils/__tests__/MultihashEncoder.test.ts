import { Hasher } from '../../crypto'
import { MultiHashEncoder } from '../MultiHashEncoder'
import { TypedArrayEncoder } from '../TypedArrayEncoder'

const validData = TypedArrayEncoder.fromUtf8String('Hello World!')
const validMultiHash = new Uint8Array([
  18, 32, 127, 131, 177, 101, 127, 241, 252, 83, 185, 45, 193, 129, 72, 161, 214, 93, 252, 45, 75, 31, 163, 214, 119,
  40, 74, 221, 210, 0, 18, 109, 144, 105,
])
const validHash = Hasher.hash(validData, 'sha-256')
const invalidMultiHash = new Uint8Array([99, 12, 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33])

describe('MultiHashEncoder', () => {
  describe('encode()', () => {
    it('encodes multihash', () => {
      const multihash = MultiHashEncoder.encode(validData, 'sha-256')
      expect(TypedArrayEncoder.equals(multihash, validMultiHash)).toBe(true)
    })

    it('does not encode SHA-1 multihashes', () => {
      expect(() => MultiHashEncoder.encode(validData, 'sha-1')).toThrow()
    })
  })

  describe('decode()', () => {
    it('Decodes multihash', () => {
      const { data, hashName } = MultiHashEncoder.decode(validMultiHash)
      expect(hashName).toEqual('sha-256')
      expect(TypedArrayEncoder.equals(data, validHash)).toBe(true)
    })

    it.each([
      ['sha-384', 48],
      ['sha-512', 64],
    ] as const)('round-trips %s multihashes', (hashName, digestLength) => {
      const multihash = MultiHashEncoder.encode(validData, hashName)
      const decoded = MultiHashEncoder.decode(multihash)

      expect(decoded.hashName).toBe(hashName)
      expect(decoded.data).toHaveLength(digestLength)
      expect(TypedArrayEncoder.equals(decoded.data, Hasher.hash(validData, hashName))).toBe(true)
    })

    it('Decodes invalid multihash', () => {
      expect(() => {
        MultiHashEncoder.decode(invalidMultiHash)
      }).toThrow()
    })

    it.each([
      new Uint8Array([0x63, 0x20, ...new Uint8Array(32)]),
      new Uint8Array([0x12, 0x1f, ...new Uint8Array(32)]),
      validMultiHash.slice(0, -1),
      new Uint8Array([...validMultiHash, 0]),
      new Uint8Array([0x12, 0x30, ...new Uint8Array(48)]),
      new Uint8Array([0x11, 0x14, ...new Uint8Array(20)]),
    ])('rejects malformed multihash %j', (multihash) => {
      expect(() => MultiHashEncoder.decode(multihash)).toThrow()
    })
  })

  describe('isValid()', () => {
    it('Validates valid multihash', () => {
      expect(MultiHashEncoder.isValid(validMultiHash)).toEqual(true)
    })

    it('Validates invalid multihash', () => {
      expect(MultiHashEncoder.isValid(invalidMultiHash)).toEqual(false)
    })
  })
})
