import { CredoError } from '../../error'
import { VarintEncoder } from '../VarintEncoder'

describe('VarintEncoder', () => {
  it.each([
    [127, [0x7f]],
    [128, [0x80, 0x01]],
    [0x0200, [0x80, 0x04]],
  ])('encodes %i canonically', (value, bytes) => {
    expect(Array.from(VarintEncoder.encode(value))).toEqual(bytes)
  })

  it('round-trips the maximum safe integer', () => {
    const encoded = VarintEncoder.encode(Number.MAX_SAFE_INTEGER)
    expect(VarintEncoder.decode(encoded)).toEqual([Number.MAX_SAFE_INTEGER, encoded.length])
  })

  it('returns the decoded length when input contains trailing bytes', () => {
    expect(VarintEncoder.decode(new Uint8Array([0x80, 0x01, 0x22]))).toEqual([128, 2])
  })

  it.each([
    new Uint8Array(),
    [0x80],
    [0x80, 0x00],
    [0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x01],
    [0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x00],
  ])('rejects malformed or unsafe encoding %j', (bytes) => {
    expect(() => VarintEncoder.decode(bytes)).toThrow(CredoError)
  })

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid encode input %s',
    (value) => {
      expect(() => VarintEncoder.encode(value)).toThrow(CredoError)
      expect(() => VarintEncoder.encodingLength(value)).toThrow(CredoError)
    }
  )
})
