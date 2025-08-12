import type { VersionString } from '@credo-ts/core'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const storageVersion = pgTable(
  'StorageVersion',
  {
    ...getPostgresBaseRecordTable(),

    storageVersion: text('storage_version').notNull().$type<VersionString>(),
  },
  (table) => postgresBaseRecordIndexes(table, 'storageVersion')
)
