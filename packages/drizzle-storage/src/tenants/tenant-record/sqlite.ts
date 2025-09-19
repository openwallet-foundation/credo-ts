import type { VersionString } from '@credo-ts/core'
import type { TenantRecord } from '@credo-ts/tenants'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const tenant = sqliteTable(
  'Tenant',
  {
    ...getSqliteBaseRecordTable(),

    storageVersion: text('storage_version').$type<VersionString>(),
    config: text({ mode: 'json' }).$type<TenantRecord['config']>().notNull(),
    label: text().notNull(),
  },
  (table) => sqliteBaseRecordIndexes(table, 'tenant')
)
