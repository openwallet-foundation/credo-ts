import { MultibaseEncoder } from '../MultibaseEncoder'
import { Buffer } from 'buffer'
import { BufferEncoder } from '../BufferEncoder'

const validData = Buffer.from('Hello World!')
const validMultibase = 'zKWfinQuRQ3ekD1danFHqvKRg9koFp8vpokUeREEgjSyHwweeKDFaxVHi'
const invalidMultibase = 'gKWfinQuRQ3ekD1danFHqvKRg9koFp8vpokUeREEgjSyHwweeKDFaxVHi'

describe('multibase', () => {
  it('Encodes multibase', () => {
    const multibase = BufferEncoder.toUtf8String(MultibaseEncoder.encode(validData, 'base58btc'))
    expect(multibase).toEqual('z2NEpo7TZRRrLZSi2U')
  })

  it('Decodes multibase', () => {
    const { data, baseName } = MultibaseEncoder.decode(validMultibase)
    expect(BufferEncoder.toUtf8String(data)).toEqual('This is a valid base58btc encoded string!')
    expect(baseName).toEqual('base58btc')
  })

  it('Validates valid multibase', () => {
    const bool = MultibaseEncoder.validate(validMultibase)
    expect(bool).toEqual(true)
  })

  it('Validates invalid multibase', () => {
    const bool = MultibaseEncoder.validate(invalidMultibase)
    expect(bool).toEqual(false)
  })

  it('Decodes invalid multibase', () => {
    expect(() => {
      MultibaseEncoder.decode(invalidMultibase)
    }).toThrow(/^Unsupported encoding: g/)
  })
})
