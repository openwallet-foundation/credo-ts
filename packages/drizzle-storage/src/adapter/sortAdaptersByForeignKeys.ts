import { type Column, getTableColumns, getTableName, type Table } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { CredoDrizzleStorageError } from '../error'
import type { AnyDrizzleAdapter } from './BaseDrizzleRecordAdapter'

export interface DrizzleAdapterForeignKey {
  /** The adapter of the table that the foreign key references. */
  parent: AnyDrizzleAdapter

  /** The keys of the foreign key columns in the values of the adapter, as returned by `getValuesWithBase`. */
  columns: string[]

  /** The keys of the referenced columns in the values of the parent adapter. */
  parentColumns: string[]
}

function getColumnKey(table: Table, column: Column) {
  // Matched by name, because the columns of a foreign key in the table config are copies of the table columns
  const key = Object.entries(getTableColumns(table)).find(([, tableColumn]) => tableColumn.name === column.name)?.[0]
  if (!key) {
    throw new CredoDrizzleStorageError(`Column '${column.name}' is not a column of table '${getTableName(table)}'`)
  }
  return key
}

/**
 * Returns the foreign keys of the table of the adapter that reference the table of another of the adapters.
 */
export function getAdapterForeignKeys(
  adapter: AnyDrizzleAdapter,
  adapters: AnyDrizzleAdapter[]
): DrizzleAdapterForeignKey[] {
  const foreignKeys: DrizzleAdapterForeignKey[] = []
  for (const foreignKey of getTableConfig(adapter.table.postgres).foreignKeys) {
    const { columns, foreignColumns, foreignTable } = foreignKey.reference()
    const parent = adapters.find((other) => getTableName(other.table.postgres) === getTableName(foreignTable))
    if (!parent || parent === adapter) continue

    foreignKeys.push({
      parent,
      columns: columns.map((column) => getColumnKey(adapter.table.postgres, column)),
      parentColumns: foreignColumns.map((column) => getColumnKey(parent.table.postgres, column)),
    })
  }
  return foreignKeys
}

/**
 * Sorts the adapters so that records can be inserted in this order without a foreign key violation.
 */
export function sortAdaptersByForeignKeys(adapters: AnyDrizzleAdapter[]): AnyDrizzleAdapter[] {
  const parentsByAdapter = new Map(
    adapters.map((adapter) => [adapter, getAdapterForeignKeys(adapter, adapters).map(({ parent }) => parent)])
  )

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
