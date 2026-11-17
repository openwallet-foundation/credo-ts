import { canonicalizeJcsStrict } from '../proof-processing/jcs'
import { W3cDataIntegrityProcessingError, W3cDataIntegrityProcessingErrorCode } from '../W3cDataIntegrityError'

describe('canonicalizeJcsStrict', () => {
  // RFC 8785 section 3.2.3
  it('sorts object keys at every level and keeps array order', () => {
    expect(canonicalizeJcsStrict({ b: 1, a: { d: [3, { f: 1, e: 2 }], c: 'x' } })).toBe(
      '{"a":{"c":"x","d":[3,{"e":2,"f":1}]},"b":1}'
    )
  })

  // RFC 8785 section 3.2.2.3
  it('serializes numbers like ECMAScript', () => {
    expect(canonicalizeJcsStrict({ a: 1.0, b: 1e21, c: -0, d: 0.1 })).toBe('{"a":1,"b":1e+21,"c":0,"d":0.1}')
  })

  it('omits undefined object fields', () => {
    expect(canonicalizeJcsStrict({ a: 1, b: undefined, c: { d: undefined } })).toBe('{"a":1,"c":{}}')
  })

  it('accepts a plain object that is referenced twice', () => {
    const shared = { x: 1 }

    expect(canonicalizeJcsStrict({ a: shared, b: shared })).toBe('{"a":{"x":1},"b":{"x":1}}')
  })

  // These values have no JSON representation, so they are rejected instead of being coerced.
  it.each([
    ['undefined in an array', { a: [1, undefined] }, 'unsupported value at $.a[1]'],
    ['a function', { a: () => 1 }, 'unsupported value at $.a'],
    ['a symbol', { a: Symbol('a') }, 'unsupported value at $.a'],
    ['a bigint', { a: BigInt(1) }, 'unsupported value at $.a'],
    ['NaN', { a: Number.NaN }, 'non-finite number at $.a'],
    ['Infinity', { a: [Number.POSITIVE_INFINITY] }, 'non-finite number at $.a[0]'],
  ])('throws PROOF_TRANSFORMATION_ERROR for %s', (_, value, message) => {
    let error: unknown
    try {
      canonicalizeJcsStrict(value)
    } catch (caught) {
      error = caught
    }

    expect(error).toBeInstanceOf(W3cDataIntegrityProcessingError)
    expect((error as W3cDataIntegrityProcessingError).issue.type).toBe(
      W3cDataIntegrityProcessingErrorCode.ProofTransformationError
    )
    expect((error as W3cDataIntegrityProcessingError).message).toContain(message)
  })
})
