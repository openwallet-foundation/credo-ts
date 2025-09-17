import { VersionString } from '@credo-ts/core'
import { TenantRecord } from '@credo-ts/tenants'
import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const tenant = pgTable(
  'Tenant',
  {
    ...getPostgresBaseRecordTable(),

    storageVersion: text('storage_version').$type<VersionString>(),
    config: jsonb().$type<TenantRecord['config']>().notNull(),
    label: text().notNull(),
  },
  (table) => postgresBaseRecordIndexes(table, 'tenant')
)
