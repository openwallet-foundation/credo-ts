import { isFirstVersionHigherThanSecond, parseVersionString } from '../version'

describe('version', () => {
  describe('parseVersionString()', () => {
    it('parses a version string to a tuple', () => {
      expect(parseVersionString('1.0')).toStrictEqual([1, 0])
      expect(parseVersionString('2.12')).toStrictEqual([2, 12])
      expect(parseVersionString('0.0')).toStrictEqual([0, 0])
    })
  })

  describe('isFirstVersionHigherThanSecond()', () => {
    it('returns true if the major version digit of the first version is higher than the second', () => {
      expect(isFirstVersionHigherThanSecond([2, 0], [1, 0])).toBe(true)
      expect(isFirstVersionHigherThanSecond([2, 1], [1, 10])).toBe(true)
    })

    it('returns false if the major version digit of the first version is lower than the second', () => {
      expect(isFirstVersionHigherThanSecond([1, 0], [2, 0])).toBe(false)
      expect(isFirstVersionHigherThanSecond([1, 10], [2, 1])).toBe(false)
    })

    it('returns true if the major version digit of both versions are equal, but the minor version of the first version is higher', () => {
      expect(isFirstVersionHigherThanSecond([1, 10], [1, 0])).toBe(true)
      expect(isFirstVersionHigherThanSecond([2, 11], [2, 10])).toBe(true)
    })

    it('returns false if the major version digit of both versions are equal, but the minor version of the second version is higher', () => {
      expect(isFirstVersionHigherThanSecond([1, 0], [1, 10])).toBe(false)
      expect(isFirstVersionHigherThanSecond([2, 10], [2, 11])).toBe(false)
    })

    it('returns false if the major and minor version digit of both versions are equal', () => {
      expect(isFirstVersionHigherThanSecond([1, 0], [1, 0])).toBe(false)
      expect(isFirstVersionHigherThanSecond([2, 10], [2, 10])).toBe(false)
    })
  })
})
