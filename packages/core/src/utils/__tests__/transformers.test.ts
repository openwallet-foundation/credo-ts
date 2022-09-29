import { JsonTransformer } from '../JsonTransformer'
import { DateTransformer } from '../transformers'

class TestDateTransformer {
  @DateTransformer()
  public date: Date

  public constructor(date: Date) {
    this.date = date
  }
}

describe('transformers', () => {
  describe('DateTransformer', () => {
    it('converts ISO date string to Date when using fromJSON', () => {
      const testDate = JsonTransformer.fromJSON({ date: '2020-01-01T00:00:00.000Z' }, TestDateTransformer)

      expect(testDate.date).toBeInstanceOf(Date)
      expect(testDate.date.getTime()).toEqual(1577836800000)
    })

    it('converts Date to ISO string when using toJSON', () => {
      const testDateJson = JsonTransformer.toJSON(new TestDateTransformer(new Date('2020-01-01T00:00:00.000Z')))

      expect(testDateJson.date).toBe('2020-01-01T00:00:00.000Z')
    })

    it('clones the Date to a new Date instance when using clone', () => {
      const oldDate = new Date('2020-01-01T00:00:00.000Z')
      const date = JsonTransformer.clone(new TestDateTransformer(oldDate))

      expect(date.date).not.toBe(oldDate)
      expect(date.date.getTime()).toEqual(oldDate.getTime())
      expect(date.date.toISOString()).toBe('2020-01-01T00:00:00.000Z')
    })
  })
})
