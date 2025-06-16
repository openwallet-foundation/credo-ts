import { VersionString } from '@credo-ts/core'
import { TenantRecord } from '@credo-ts/tenants'
import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { postgresBaseRecordTable } from '../../postgres'
import { postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const tenant = pgTable(
  'Tenant',
  {
    ...postgresBaseRecordTable,

    storageVersion: text('storage_version').$type<VersionString>(),
    config: jsonb().$type<TenantRecord['config']>(),
    label: text().notNull(),
  },
  (table) => postgresBaseRecordIndexes(table, 'tenant')
)
