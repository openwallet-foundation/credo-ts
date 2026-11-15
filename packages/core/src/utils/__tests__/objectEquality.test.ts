import { areObjectsEqual } from '../objectEquality'

describe('areObjectsEqual', () => {
  test('evaluates to true with equal nested objects and arrays', () => {
    expect(areObjectsEqual({ a: [1, { b: 'c' }] }, { a: [1, { b: 'c' }] })).toBe(true)
  })

  test('ignores undefined-valued keys, like JSON serialization does', () => {
    expect(areObjectsEqual<object>({ a: 1, b: undefined }, { a: 1 })).toBe(true)
  })

  test('evaluates to false for an array and an object with the same entries', () => {
    expect(areObjectsEqual<object>(['x'], { 0: 'x' })).toBe(false)
    expect(areObjectsEqual({ a: { 0: 'x' } }, { a: ['x'] })).toBe(false)
  })

  test('evaluates to false for arrays of different length', () => {
    expect(areObjectsEqual([undefined], [])).toBe(false)
  })
})
