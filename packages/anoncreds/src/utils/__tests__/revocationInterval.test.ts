import { assertBestPracticeRevocationInterval } from '../../utils'

describe('assertBestPracticeRevocationInterval', () => {
  test("throws if no 'to' value is specified", () => {
    expect(() =>
      assertBestPracticeRevocationInterval({
        from: 10,
      })
    ).toThrow()
  })

  test("throws if a 'from' value is specified and it is different from 'to'", () => {
    expect(() =>
      assertBestPracticeRevocationInterval({
        to: 5,
        from: 10,
      })
    ).toThrow()
  })

  test('does not throw if only to is provided', () => {
    expect(() =>
      assertBestPracticeRevocationInterval({
        to: 5,
      })
    ).not.toThrow()
  })

  test('does not throw if from and to are equal', () => {
    expect(() =>
      assertBestPracticeRevocationInterval({
        to: 10,
        from: 10,
      })
    ).not.toThrow()
  })
})
