import { getTableName } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { CredoDrizzleStorageError } from '../error'
import type { AnyDrizzleAdapter } from './BaseDrizzleRecordAdapter'

/**
 * Sorts the adapters so that an adapter comes after the adapters whose tables its table references
 * with a foreign key. Records inserted in this order never reference a record that is not inserted yet.
 *
 * The order is read from the PostgreSQL tables. The SQLite tables have the same foreign keys.
 */
export function sortAdaptersByForeignKeys(adapters: AnyDrizzleAdapter[]): AnyDrizzleAdapter[] {
  const parentsByAdapter = new Map<AnyDrizzleAdapter, AnyDrizzleAdapter[]>()
  for (const adapter of adapters) {
    const parents = new Set<AnyDrizzleAdapter>()
    for (const foreignKey of getTableConfig(adapter.table.postgres).foreignKeys) {
      const foreignTableName = getTableName(foreignKey.reference().foreignTable)
      const parent = adapters.find((other) => getTableName(other.table.postgres) === foreignTableName)
      // A table without an adapter, such as `Context`, has no records to order
      if (parent && parent !== adapter) parents.add(parent)
    }
    parentsByAdapter.set(adapter, [...parents])
  }

  const sorted: AnyDrizzleAdapter[] = []
  const remaining = [...adapters]
  while (remaining.length > 0) {
    const index = remaining.findIndex((adapter) =>
      parentsByAdapter.get(adapter)?.every((parent) => sorted.includes(parent))
    )
    if (index === -1) {
      throw new CredoDrizzleStorageError(
        `The foreign keys between the tables of the record types ${remaining
          .map((adapter) => `'${adapter.recordClass.type}'`)
          .join(', ')} form a cycle`
      )
    }
    sorted.push(...remaining.splice(index, 1))
  }

  return sorted
}
