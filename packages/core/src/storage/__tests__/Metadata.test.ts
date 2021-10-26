import { TestRecord } from './TestRecord'

describe('Metadata', () => {
  const testRecord = new TestRecord()

  test('set() as create', () => {
    testRecord.metadata.set('bar', { aries: { framework: 'javascript' } })

    expect(testRecord.toJSON()).toMatchObject({
      metadata: { bar: { aries: { framework: 'javascript' } } },
    })
  })

  test('set() as update ', () => {
    expect(testRecord.toJSON()).toMatchObject({
      metadata: { bar: { aries: { framework: 'javascript' } } },
    })

    testRecord.metadata.set('bar', { baz: 'foo' })

    expect(testRecord.toJSON()).toMatchObject({
      metadata: { bar: { baz: 'foo' } },
    })
  })

  test('get()', () => {
    const record = testRecord.metadata.get<{ baz: 'foo' }>('bar')

    expect(record).toMatchObject({ baz: 'foo' })
  })

  test('delete()', () => {
    testRecord.metadata.delete('bar')

    expect(testRecord.toJSON()).toMatchObject({
      metadata: {},
    })
  })

  test('getAll()', () => {
    testRecord.metadata.set('bar', { baz: 'foo' })
    testRecord.metadata.set('bazz', { blub: 'foo' })
    testRecord.metadata.set('test', { abc: { def: 'hij' } })

    const record = testRecord.metadata.getAll()

    expect(record).toMatchObject({
      bar: { baz: 'foo' },
      bazz: { blub: 'foo' },
      test: { abc: { def: 'hij' } },
    })
  })
})
