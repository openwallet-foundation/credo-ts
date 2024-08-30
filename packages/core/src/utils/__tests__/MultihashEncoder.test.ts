import { Hasher } from '../../crypto'
import { MultiHashEncoder } from '../MultiHashEncoder'
import { Buffer } from '../buffer'

const validData = Buffer.from('Hello World!')
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
      expect(multihash.equals(Buffer.from(validMultiHash))).toBe(true)
    })
  })

  describe('decode()', () => {
    it('Decodes multihash', () => {
      const { data, hashName } = MultiHashEncoder.decode(validMultiHash)
      expect(hashName).toEqual('sha-256')
      expect(data.equals(Buffer.from(validHash))).toBe(true)
    })

    it('Decodes invalid multihash', () => {
      expect(() => {
        MultiHashEncoder.decode(invalidMultiHash)
      }).toThrow()
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
