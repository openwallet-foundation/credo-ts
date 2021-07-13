import { Buffer } from 'buffer'

import { BufferEncoder } from '../BufferEncoder'
import { MultiHashEncoder } from '../MultiHashEncoder'

const validData = Buffer.from('Hello World!')
const validMultiHash = new Uint8Array([18, 12, 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33])
const invalidMultiHash = new Uint8Array([99, 12, 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33])

describe('multihash', () => {
  describe('encode()', () => {
    it('encodes multihash', () => {
      const multihash = MultiHashEncoder.encode(validData, 'sha2-256')
      expect(multihash).toEqual(new Uint8Array([18, 12, 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33]))
    })
  })

  describe('decode()', () => {
    it('Decodes multihash', () => {
      const { data, hashName } = MultiHashEncoder.decode(validMultiHash)
      expect(hashName).toEqual('sha2-256')
      expect(BufferEncoder.toUtf8String(data)).toEqual('Hello World!')
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
