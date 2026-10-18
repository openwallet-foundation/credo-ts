import { IsString } from 'class-validator'
import { z } from 'zod'
import { ClassValidationError, ZodValidationError } from '../../error'
import { JsonTransformer, zJsonTransformerClass } from '../../utils/JsonTransformer'
import { MessageValidator } from '../../utils/MessageValidator'
import { zIsoDate } from '../../utils/zod'
import { BaseRecord } from '../BaseRecord'
import { createRecordEncodingSchema } from '../recordEncodingSchema'
import { TestRecord } from './TestRecord'

class LegacyNested {
  @IsString()
  public name!: string
}

const zodTestRecordEncodingSchema = createRecordEncodingSchema(
  {
    foo: z.string(),
    expiresAt: zIsoDate.optional(),
    nested: zJsonTransformerClass(() => LegacyNested).optional(),
  },
  {
    upgrade: ({ oldFoo, ...encoded }) => (oldFoo !== undefined ? { ...encoded, foo: oldFoo } : encoded),
  }
)

class ZodTestRecord extends BaseRecord<{ foo: string }> {
  public static get encodingSchema(): z.ZodType {
    return zodTestRecordEncodingSchema
  }

  public static readonly type = 'ZodTestRecord'
  public readonly type = ZodTestRecord.type

  public static readonly allowCache = true
  public readonly allowCache = true

  public foo!: string
  public expiresAt?: Date
  public nested?: LegacyNested

  public constructor(props?: { id: string; createdAt: Date; foo: string; expiresAt?: Date; nested?: LegacyNested }) {
    super()

    if (props) {
      this.id = props.id
      this.createdAt = props.createdAt
      this.foo = props.foo
      this.expiresAt = props.expiresAt
      this.nested = props.nested
    }
  }

  public getTags() {
    return { ...this._tags, foo: this.foo }
  }
}

const nested = new LegacyNested()
nested.name = 'nested'

const record = new ZodTestRecord({
  id: 'record-id',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  foo: 'bar',
  expiresAt: new Date('2027-01-01T00:00:00.000Z'),
  nested,
})
record.metadata.set('meta', { key: 'value' })
record.setTag('custom', 'tag')

const recordJson = {
  id: 'record-id',
  createdAt: '2026-01-01T00:00:00.000Z',
  foo: 'bar',
  expiresAt: '2027-01-01T00:00:00.000Z',
  nested: { name: 'nested' },
  metadata: { meta: { key: 'value' } },
  _tags: { custom: 'tag' },
}

describe('createRecordEncodingSchema', () => {
  test('encodes a record to the same JSON as class-transformer', () => {
    expect(JsonTransformer.toJSON(record)).toStrictEqual(recordJson)
    expect(JSON.parse(JsonTransformer.serialize(record))).toStrictEqual(recordJson)
    expect(record.toJSON()).toStrictEqual(recordJson)
  })

  test('decodes a record from JSON', () => {
    const decoded = JsonTransformer.fromJSON(recordJson, ZodTestRecord)

    expect(decoded).toBeInstanceOf(ZodTestRecord)
    expect(decoded).toEqual(record)
    expect(decoded.createdAt).toBeInstanceOf(Date)
    expect(decoded.nested).toBeInstanceOf(LegacyNested)
    expect(decoded.metadata.get('meta')).toEqual({ key: 'value' })
    expect(decoded.type).toEqual('ZodTestRecord')
    expect(decoded.allowCache).toEqual(true)
    expect(JsonTransformer.deserialize(JSON.stringify(recordJson), ZodTestRecord)).toEqual(record)
  })

  test('accepts dates as Date instances', () => {
    const decoded = JsonTransformer.fromJSON(
      { ...recordJson, createdAt: new Date('2026-01-01T00:00:00.000Z') },
      ZodTestRecord
    )

    expect(decoded.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'))
  })

  test('keeps properties that are not in the schema, but ignores type and allowCache', () => {
    const decoded = JsonTransformer.fromJSON(
      { ...recordJson, legacyProperty: 'legacy', type: 'OtherType', allowCache: false },
      ZodTestRecord
    )

    expect((decoded as unknown as { legacyProperty: string }).legacyProperty).toEqual('legacy')
    expect(decoded.type).toEqual('ZodTestRecord')
    expect(decoded.allowCache).toEqual(true)
    expect(JsonTransformer.toJSON(decoded)).toStrictEqual({ ...recordJson, legacyProperty: 'legacy' })
  })

  test('upgrades records stored in an older format', () => {
    const { foo, ...legacyJson } = recordJson
    const decoded = JsonTransformer.fromJSON({ ...legacyJson, oldFoo: 'old' }, ZodTestRecord)

    expect(decoded.foo).toEqual('old')
    expect(JsonTransformer.toJSON(decoded)).toStrictEqual({ ...recordJson, foo: 'old' })
  })

  test('throws a ZodValidationError for invalid records', () => {
    expect(() => JsonTransformer.fromJSON({ ...recordJson, foo: 10 }, ZodTestRecord)).toThrow(ZodValidationError)
    expect(() => JsonTransformer.fromJSON({ ...recordJson, createdAt: 'not a date' }, ZodTestRecord)).toThrow(
      ZodValidationError
    )

    // Validation errors of nested class-transformer classes are reported as zod issues
    expect(() => JsonTransformer.fromJSON({ ...recordJson, nested: { name: 10 } }, ZodTestRecord)).toThrow(
      ZodValidationError
    )

    const invalidRecord = JsonTransformer.clone(record)
    invalidRecord.foo = 10 as unknown as string
    expect(() => MessageValidator.validateSync(invalidRecord)).toThrow(ZodValidationError)
    expect(() => JsonTransformer.toJSON(invalidRecord)).toThrow(ZodValidationError)
  })

  test('clones a record without sharing state', () => {
    const cloned = record.clone()

    expect(cloned).toBeInstanceOf(ZodTestRecord)
    expect(cloned).toEqual(record)

    cloned.metadata.add('meta', { other: 'value' })
    if (cloned.nested) cloned.nested.name = 'changed'
    expect(record.metadata.get('meta')).toEqual({ key: 'value' })
    expect(record.nested?.name).toEqual('nested')
  })

  test('decoded records do not share state with the JSON', () => {
    const json = structuredClone(recordJson)
    const decoded = JsonTransformer.fromJSON(json, ZodTestRecord)

    decoded.metadata.add('meta', { other: 'value' })
    expect(json.metadata.meta).toEqual({ key: 'value' })
  })

  test('records without an encoding schema still use class-transformer', () => {
    const testRecord = new TestRecord({ id: 'test-id', createdAt: new Date('2026-01-01T00:00:00.000Z'), foo: 'bar' })

    expect(JsonTransformer.toJSON(testRecord)).toEqual({
      id: 'test-id',
      createdAt: '2026-01-01T00:00:00.000Z',
      foo: 'bar',
      metadata: {},
      _tags: {},
    })
    expect(JsonTransformer.fromJSON(JsonTransformer.toJSON(testRecord), TestRecord)).toEqual(testRecord)
    expect(() => JsonTransformer.fromJSON({ name: 10 }, LegacyNested)).toThrow(ClassValidationError)
  })
})
