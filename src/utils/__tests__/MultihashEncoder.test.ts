import { MultihashEncoder } from '../MultihashEncoder'
import { Buffer } from 'buffer'
import { BufferEncoder } from '../BufferEncoder'

const validData = Buffer.from('Hello World!')
const validMultihash = new Uint8Array([18, 12, 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33])
const invalidMultihash = new Uint8Array([99, 12, 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33])

describe('multihash', () => {
  describe('encode()', () => {
    it('encodes multihash', () => {
      const multihash = MultihashEncoder.encode(validData, 'sha2-256')
      expect(multihash).toEqual(new Uint8Array([18, 12, 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33]))
    })
  })

  describe('decode()', () => {
    it('Decodes multihash', () => {
      const { data, hashName } = MultihashEncoder.decode(validMultihash)
      expect(hashName).toEqual('sha2-256')
      expect(BufferEncoder.toUtf8String(data)).toEqual('Hello World!')
    })

    it('Decodes invalid multihash', () => {
      expect(() => {
        MultihashEncoder.decode(invalidMultihash)
      }).toThrow()
    })
  })

  describe('validate()', () => {
    it('Validates valid multihash', () => {
      const bool = MultihashEncoder.validate(validMultihash)
      expect(bool).toEqual(true)
    })

    it('Validates invalid multihash', () => {
      const bool = MultihashEncoder.validate(invalidMultihash)
      expect(bool).toEqual(false)
    })
  })
})
