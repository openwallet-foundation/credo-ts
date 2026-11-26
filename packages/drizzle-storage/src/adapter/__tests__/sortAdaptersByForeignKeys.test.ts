import {
  DidCommBasicMessageRecord,
  DidCommConnectionRecord,
  DidCommMediationRecord,
  DidCommProofExchangeRecord,
} from '@credo-ts/didcomm'
import { type AnyPgColumn, pgTable, text } from 'drizzle-orm/pg-core'
import { coreBundle } from '../../core/bundle'
import type { DrizzleRecord } from '../../DrizzleRecord'
import { didcommBundle } from '../../didcomm/bundle'
import type { AnyDrizzleAdapter } from '../BaseDrizzleRecordAdapter'
import { getAdapterForeignKeys, sortAdaptersByForeignKeys } from '../sortAdaptersByForeignKeys'

const records: DrizzleRecord[] = [...coreBundle.records, ...didcommBundle.records]
const adapters = records
  .map((record) => (record.adapter ? (new record.adapter({} as never) as AnyDrizzleAdapter) : undefined))
  .filter((adapter) => adapter !== undefined)
const typesOf = (sorted: AnyDrizzleAdapter[]) => sorted.map((adapter) => adapter.recordClass.type)

describe('sortAdaptersByForeignKeys', () => {
  test('puts the connection adapter before the adapters whose tables reference the connection table', () => {
    const sorted = typesOf(sortAdaptersByForeignKeys([...adapters].reverse()))

    expect(sorted).toHaveLength(adapters.length)
    const connection = sorted.indexOf(DidCommConnectionRecord.type)
    for (const child of [
      DidCommMediationRecord.type,
      DidCommBasicMessageRecord.type,
      DidCommProofExchangeRecord.type,
    ]) {
      expect(sorted.indexOf(child)).toBeGreaterThan(connection)
    }
  })

  test('keeps the order of adapters whose tables have no foreign keys to other record tables', () => {
    const independent = adapters.filter(
      (adapter) =>
        ![DidCommMediationRecord.type, DidCommBasicMessageRecord.type, DidCommProofExchangeRecord.type].includes(
          adapter.recordClass.type
        )
    )

    expect(typesOf(sortAdaptersByForeignKeys(independent))).toEqual(typesOf(independent))
  })

  test('throws when the foreign keys form a cycle', () => {
    const first = pgTable('first', {
      id: text().primaryKey(),
      secondId: text().references((): AnyPgColumn => second.id),
    })
    const second = pgTable('second', { id: text().primaryKey(), firstId: text().references(() => first.id) })
    const cyclicAdapters = [
      { table: { postgres: first }, recordClass: { type: 'First' } },
      { table: { postgres: second }, recordClass: { type: 'Second' } },
    ] as unknown as AnyDrizzleAdapter[]

    expect(() => sortAdaptersByForeignKeys(cyclicAdapters)).toThrow(
      "The foreign keys between the tables of the record types 'First', 'Second' form a cycle"
    )
  })
})

describe('getAdapterForeignKeys', () => {
  test('returns the keys of the columns of a foreign key to the connection table', () => {
    const mediation = adapters.find((adapter) => adapter.recordClass.type === DidCommMediationRecord.type)
    const connection = adapters.find((adapter) => adapter.recordClass.type === DidCommConnectionRecord.type)

    expect(mediation && getAdapterForeignKeys(mediation, adapters)).toEqual([
      {
        parent: connection,
        columns: ['connectionId', 'contextCorrelationId'],
        parentColumns: ['id', 'contextCorrelationId'],
      },
    ])
  })
})
