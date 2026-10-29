import { DateOnly } from '@owf/mdoc'
import { mdocElementValueForQuery, mdocNameSpacesForQuery } from '../mdocUtil'

describe('mdocElementValueForQuery', () => {
  test('keeps JSON primitives', () => {
    expect(mdocElementValueForQuery('text')).toBe('text')
    expect(mdocElementValueForQuery(42)).toBe(42)
    expect(mdocElementValueForQuery(1.5)).toBe(1.5)
    expect(mdocElementValueForQuery(true)).toBe(true)
    expect(mdocElementValueForQuery(null)).toBe(null)
  })

  test('converts a full-date to its YYYY-MM-DD string', () => {
    expect(mdocElementValueForQuery(new DateOnly('2007-03-25'))).toBe('2007-03-25')
  })

  test('converts a tdate to its RFC 3339 string, without fractional seconds unless it has them', () => {
    expect(mdocElementValueForQuery(new Date('2023-10-24T12:00:00Z'))).toBe('2023-10-24T12:00:00Z')
    expect(mdocElementValueForQuery(new Date('2023-10-24T12:00:00.250Z'))).toBe('2023-10-24T12:00:00.250Z')
  })

  test('keeps an invalid date as it is', () => {
    const invalidFullDate = new DateOnly('2024-13-45')
    const invalidTdate = new Date('not-a-date')

    expect(mdocElementValueForQuery(invalidFullDate)).toBe(invalidFullDate)
    expect(mdocElementValueForQuery(invalidTdate)).toBe(invalidTdate)
  })

  test('converts a bigint to a number when it is a safe integer', () => {
    expect(mdocElementValueForQuery(BigInt(42))).toBe(42)

    const large = BigInt('18446744073709551615')
    expect(mdocElementValueForQuery(large)).toBe(large)
  })

  test('keeps values without a JSON primitive equivalent as they are', () => {
    const bytes = new Uint8Array([1, 2, 3])
    expect(mdocElementValueForQuery(bytes)).toBe(bytes)
    expect(mdocElementValueForQuery(undefined)).toBeUndefined()
    expect(mdocElementValueForQuery(Number.NaN)).toBeNaN()
  })

  test('keeps arrays and maps as they are by default', () => {
    const list = [new DateOnly('2023-09-01')]
    const map = new Map([['issue_date', new DateOnly('2023-09-01')]])

    expect(mdocElementValueForQuery(list)).toBe(list)
    expect(mdocElementValueForQuery(map)).toBe(map)
  })

  test('with nested, converts arrays and maps element by element, maps to objects with their string keys', () => {
    const bytes = new Uint8Array([1])
    expect(
      mdocElementValueForQuery(
        [
          new Map<unknown, unknown>([
            ['vehicle_category_code', 'C'],
            ['issue_date', new DateOnly('2023-09-01')],
            ['codes', new Map([['nested', bytes]])],
            // A key that isn't a string can't be addressed by a name, and `1` would collide with `'1'`
            [1, 'number key'],
            ['1', 'string key'],
            [bytes, 'byte string key'],
          ]),
          { codes: [{ code: 'D', sign: '<=' }] },
        ],
        { nested: true }
      )
    ).toStrictEqual([
      { vehicle_category_code: 'C', issue_date: '2023-09-01', codes: { nested: bytes }, '1': 'string key' },
      { codes: [{ code: 'D', sign: '<=' }] },
    ])
  })

  test('with nested, keeps a __proto__ key as an own property', () => {
    const converted = mdocElementValueForQuery(new Map([['__proto__', { polluted: true }]]), {
      nested: true,
    }) as Record<string, unknown>

    expect(Object.getPrototypeOf(converted)).toBe(Object.prototype)
    expect(Object.hasOwn(converted, '__proto__')).toBe(true)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})

describe('mdocNameSpacesForQuery', () => {
  test('converts the element values of every name space', () => {
    const portrait = new Uint8Array([1, 2, 3])

    expect(
      mdocNameSpacesForQuery({
        'org.iso.18013.5.1': { birth_date: new DateOnly('2007-03-25'), age_over_18: false, portrait },
        'org.iso.18013.5.1.aamva': { DHS_compliance: 'F' },
      })
    ).toStrictEqual({
      'org.iso.18013.5.1': { birth_date: '2007-03-25', age_over_18: false, portrait },
      'org.iso.18013.5.1.aamva': { DHS_compliance: 'F' },
    })
  })

  test('converts the values inside the data elements with nested', () => {
    const privileges = [new Map([['issue_date', new DateOnly('2023-09-01')]])]

    expect(mdocNameSpacesForQuery({ 'org.iso.18013.5.1': { privileges } })).toStrictEqual({
      'org.iso.18013.5.1': { privileges },
    })
    expect(mdocNameSpacesForQuery({ 'org.iso.18013.5.1': { privileges } }, { nested: true })).toStrictEqual({
      'org.iso.18013.5.1': { privileges: [{ issue_date: '2023-09-01' }] },
    })
  })
})
