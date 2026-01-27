import { Buffer } from '../buffer'
import { MultiBaseEncoder } from '../MultiBaseEncoder'
import { TypedArrayEncoder } from '../TypedArrayEncoder'

const validData = Buffer.from('Hello World!')
const validMultiBase = 'zKWfinQuRQ3ekD1danFHqvKRg9koFp8vpokUeREEgjSyHwweeKDFaxVHi'
const invalidMultiBase = 'gKWfinQuRQ3ekD1danFHqvKRg9koFp8vpokUeREEgjSyHwweeKDFaxVHi'

describe('MultiBaseEncoder', () => {
  describe('encode()', () => {
    it('Encodes valid multibase', () => {
      const multibase = MultiBaseEncoder.encode(validData, 'base58btc')
      expect(multibase).toEqual('z2NEpo7TZRRrLZSi2U')
    })
  })

  describe('Decodes()', () => {
    it('Decodes multibase', () => {
      const { data, baseName } = MultiBaseEncoder.decode(validMultiBase)
      expect(TypedArrayEncoder.toUtf8String(data)).toEqual('This is a valid base58btc encoded string!')
      expect(baseName).toEqual('base58btc')
    })

    it('Decodes invalid multibase', () => {
      expect(() => {
        MultiBaseEncoder.decode(invalidMultiBase)
      }).toThrow(/^No decoder found for multibase prefix/)
    })
  })

  describe('isValid()', () => {
    it('Validates valid multibase', () => {
      expect(MultiBaseEncoder.isValid(validMultiBase)).toEqual(true)
    })

    it('Validates invalid multibase', () => {
      expect(MultiBaseEncoder.isValid(invalidMultiBase)).toEqual(false)
    })
  })
})
