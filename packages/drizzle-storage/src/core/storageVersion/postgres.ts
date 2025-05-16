import { VersionString } from '@credo-ts/core'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { postgresBaseRecordTable } from '../../postgres'
import { postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const storageVersion = pgTable(
  'StorageVersion',
  {
    ...postgresBaseRecordTable,

    storageVersion: text('storage_version').notNull().$type<VersionString>(),
  },
  (table) => postgresBaseRecordIndexes(table, 'storageVersion')
)
