import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { ClassConstructor } from 'class-transformer'
import type { BaseRecordAny } from '../src/storage/BaseRecord'
import { JsonTransformer } from '../src/utils/JsonTransformer'

/**
 * Tests that records encode to, and decode from, the JSON in `<fixturesDirectory>/<name>.json`.
 *
 * The fixtures are records as stored by earlier versions of Credo. Don't update them to make a test pass,
 * as already stored records must keep loading. A changed storage format needs a storage migration.
 * A missing fixture is written from the current encoding, except in CI.
 */
export function testRecordEncoding(fixturesDirectory: string, createRecords: Record<string, () => BaseRecordAny>) {
  describe.each(Object.entries(createRecords))('%s', (name, createRecord) => {
    const fixturePath = path.join(fixturesDirectory, `${name}.json`)

    test('encodes to the stored format', () => {
      const record = createRecord()
      const json = JSON.parse(JsonTransformer.serialize(record))

      if (!existsSync(fixturePath)) {
        if (process.env.CI) throw new Error(`Missing record fixture ${fixturePath}`)
        writeFileSync(fixturePath, `${JSON.stringify(sortKeys(json), null, 2)}\n`)
      }

      expect(json).toStrictEqual(JSON.parse(readFileSync(fixturePath, 'utf-8')))
      expect(JSON.parse(JSON.stringify(record.toJSON()))).toStrictEqual(json)
    })

    test('decodes from the stored format', () => {
      const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'))
      const record = createRecord()
      const decoded = JsonTransformer.fromJSON(fixture, record.constructor as ClassConstructor<BaseRecordAny>)

      expect(decoded).toBeInstanceOf(record.constructor)
      expect(decoded).toEqual(record)
      expect(decoded.getTags()).toEqual(record.getTags())
      expect(JSON.parse(JsonTransformer.serialize(decoded))).toStrictEqual(fixture)
      expect(JSON.parse(JsonTransformer.serialize(decoded.clone()))).toStrictEqual(fixture)
    })
  })
}

// Sorted, so a written fixture doesn't depend on the order properties are set in
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value === null || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, sortKeys(item)])
  )
}
