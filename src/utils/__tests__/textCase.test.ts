import { titleCase } from '../textCase'

describe('Utils | TextCase', () => {
  describe('titleCase()', () => {
    it('should transform the string into title case', () => {
      expect(titleCase('some_random_string')).toBe('Some Random String')
      expect(titleCase('some-random-string')).toBe('Some Random String')
      expect(titleCase('some-random_string')).toBe('Some Random String')
      expect(titleCase('some random_string')).toBe('Some Random String')
      expect(titleCase('some Random string')).toBe('Some Random String')
    })
  })
})
