import type { VersionString } from '@credo-ts/core'
import type { TenantRecord, TenantStatus } from '@credo-ts/tenants'
import { jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'
import { exhaustiveArray } from '../../util'

export const tenantStatuses = exhaustiveArray({} as TenantStatus, ['active', 'inactive'] as const)
export const tenantStatusEnum = pgEnum('TenantStatus', tenantStatuses)

export const tenant = pgTable(
  'Tenant',
  {
    ...getPostgresBaseRecordTable(),

    storageVersion: text('storage_version').$type<VersionString>(),
    config: jsonb().$type<TenantRecord['config']>().notNull(),
    label: text().notNull(),
    status: tenantStatusEnum().notNull().default('active'),
  },
  (table) => postgresBaseRecordIndexes(table, 'tenant')
)
