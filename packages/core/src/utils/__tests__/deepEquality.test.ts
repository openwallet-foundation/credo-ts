import { Metadata } from '../../storage/Metadata'
import { deepEquality } from '../deepEquality'

describe('deepEquality', () => {
  test('evaluates to true with equal maps', () => {
    const a = new Map([
      ['foo', 1],
      ['bar', 2],
      ['baz', 3],
    ])
    const b = new Map([
      ['foo', 1],
      ['bar', 2],
      ['baz', 3],
    ])
    expect(deepEquality(a, b)).toBe(true)
  })
  test('evaluates to false with unequal maps', () => {
    const c = new Map([
      ['foo', 1],
      ['baz', 3],
      ['bar', 2],
    ])

    const d = new Map([
      ['foo', 1],
      ['bar', 2],
      ['qux', 3],
    ])
    expect(deepEquality(c, d)).toBe(false)
  })

  test('evaluates to true with equal maps with different order', () => {
    const a = new Map([
      ['baz', 3],
      ['bar', 2],
      ['foo', 1],
    ])
    const b = new Map([
      ['foo', 1],
      ['bar', 2],
      ['baz', 3],
    ])
    expect(deepEquality(a, b)).toBe(true)
  })
  test('evaluates to true with equal primitives', () => {
    expect(deepEquality(1, 1)).toBe(true)
    expect(deepEquality(true, true)).toBe(true)
    expect(deepEquality('a', 'a')).toBe(true)
  })

  test('evaluates to false with unequal primitives', () => {
    expect(deepEquality(1, 2)).toBe(false)
    expect(deepEquality(true, false)).toBe(false)
    expect(deepEquality('a', 'b')).toBe(false)
  })

  test('evaluates to true with equal complex types', () => {
    const fn = () => 'hello World!'
    expect(deepEquality(fn, fn)).toBe(true)
    expect(deepEquality({}, {})).toBe(true)
    expect(deepEquality({ foo: 'bar' }, { foo: 'bar' })).toBe(true)
    expect(deepEquality({ foo: 'baz', bar: 'bar' }, { bar: 'bar', foo: 'baz' })).toBe(true)
    expect(deepEquality(Metadata, Metadata)).toBe(true)
    expect(deepEquality(new Metadata({}), new Metadata({}))).toBe(true)
  })

  test('evaluates to false with unequal complex types', () => {
    const fn = () => 'hello World!'
    const fnTwo = () => 'Goodbye World!'
    class Bar {}
    expect(deepEquality(fn, fnTwo)).toBe(false)
    expect(deepEquality({ bar: 'foo' }, { a: 'b' })).toBe(false)
    expect(deepEquality({ b: 'a' }, { b: 'a', c: 'd' })).toBe(false)
    expect(deepEquality(Metadata, Bar)).toBe(false)
    expect(deepEquality(new Metadata({}), new Bar())).toBe(false)
  })
})
