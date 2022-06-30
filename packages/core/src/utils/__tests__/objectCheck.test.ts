import { objectEquals } from '../objectCheck'

describe('objectEquals', () => {
  it('correctly evaluates whether two map objects are equal', () => {
    const mapA: Map<string, unknown> = new Map([
      ['foo', 1],
      ['bar', 2],
      ['baz', 3],
    ])
    const mapB: Map<string, unknown> = new Map([
      ['foo', 1],
      ['bar', 2],
      ['baz', 3],
    ])
    let retVal = objectEquals(mapA, mapB)

    // if the order is different, maps still equal
    const mapC: Map<string, unknown> = new Map([
      ['foo', 1],
      ['baz', 3],
      ['bar', 2],
    ])
    retVal = objectEquals(mapA, mapC)
    expect(retVal).toBe(true)

    const mapD: Map<string, unknown> = new Map([
      ['foo', 1],
      ['bar', 2],
      ['qux', 3],
    ])
    retVal = objectEquals(mapA, mapD)
    expect(retVal).toBe(false)
  })
})
