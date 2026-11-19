import {
  DidCommBasicMessageRecord,
  DidCommConnectionRecord,
  DidCommMediationRecord,
  DidCommProofExchangeRecord,
} from '@credo-ts/didcomm'
import { coreBundle } from '../../core/bundle'
import type { DrizzleRecord } from '../../DrizzleRecord'
import { didcommBundle } from '../../didcomm/bundle'
import type { AnyDrizzleAdapter } from '../BaseDrizzleRecordAdapter'
import { sortAdaptersByForeignKeys } from '../sortAdaptersByForeignKeys'

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
})
