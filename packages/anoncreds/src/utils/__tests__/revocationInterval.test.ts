import { assertRevocationInterval } from '../../utils'

describe('assertRevocationInterval', () => {
  test("throws if no 'to' value is specified", () => {
    expect(() =>
      assertRevocationInterval({
        from: 10,
      })
    ).toThrow()
  })

  test("throws if a 'from' value is specified and it is different from 'to'", () => {
    expect(() =>
      assertRevocationInterval({
        to: 5,
        from: 10,
      })
    ).toThrow()
  })

  test('does not throw if only to is provided', () => {
    expect(() =>
      assertRevocationInterval({
        to: 5,
      })
    ).not.toThrow()
  })

  test('does not throw if from and to are equal', () => {
    expect(() =>
      assertRevocationInterval({
        to: 10,
        from: 10,
      })
    ).not.toThrow()
  })
})
