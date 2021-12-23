import { TestRecord } from './TestRecord'

describe('Metadata', () => {
  let testRecord: TestRecord

  beforeEach(() => {
    testRecord = new TestRecord()
  })

  test('set() as create', () => {
    testRecord.metadata.set('bar', { aries: { framework: 'javascript' } })

    expect(testRecord.toJSON()).toMatchObject({
      metadata: { bar: { aries: { framework: 'javascript' } } },
    })
  })

  test('set() as update ', () => {
    testRecord.metadata.set('bar', { baz: 'abc' })
    expect(testRecord.toJSON()).toMatchObject({
      metadata: { bar: { baz: 'abc' } },
    })

    testRecord.metadata.set('bar', { baz: 'foo' })
    expect(testRecord.toJSON()).toMatchObject({
      metadata: { bar: { baz: 'foo' } },
    })
  })

  test('add() ', () => {
    testRecord.metadata.set('sample', { foo: 'bar' })
    testRecord.metadata.add('sample', { baz: 'foo' })

    expect(testRecord.toJSON()).toMatchObject({
      metadata: { sample: { foo: 'bar', baz: 'foo' } },
    })
  })

  test('get()', () => {
    testRecord.metadata.set('bar', { baz: 'foo' })
    const record = testRecord.metadata.get<{ baz: 'foo' }>('bar')

    expect(record).toMatchObject({ baz: 'foo' })
  })

  test('delete()', () => {
    testRecord.metadata.set('bar', { baz: 'foo' })
    testRecord.metadata.delete('bar')

    expect(testRecord.toJSON()).toMatchObject({
      metadata: {},
    })
  })

  test('keys()', () => {
    testRecord.metadata.set('bar', { baz: 'foo' })
    testRecord.metadata.set('bazz', { blub: 'foo' })
    testRecord.metadata.set('test', { abc: { def: 'hij' } })

    const keys = testRecord.metadata.keys

    expect(keys).toMatchObject(['bar', 'bazz', 'test'])
  })
})
