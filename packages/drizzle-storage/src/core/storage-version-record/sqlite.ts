import type { VersionString } from '@credo-ts/core'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const storageVersion = sqliteTable(
  'StorageVersion',
  {
    ...getSqliteBaseRecordTable(),

    storageVersion: text('storage_version').notNull().$type<VersionString>(),
  },
  (table) => sqliteBaseRecordIndexes(table, 'storageVersion')
)
