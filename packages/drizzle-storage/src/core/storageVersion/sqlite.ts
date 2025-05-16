import { VersionString } from '@credo-ts/core'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sqliteBaseRecordTable } from '../../sqlite'
import { sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const storageVersion = sqliteTable(
  'StorageVersion',
  {
    ...sqliteBaseRecordTable,

    storageVersion: text('storage_version').notNull().$type<VersionString>(),
  },
  (table) => sqliteBaseRecordIndexes(table, 'storageVersion')
)
