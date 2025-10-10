import { foreignKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'
import { tenant } from '../tenant-record/sqlite'

export const tenantRouting = sqliteTable(
  'TenantRouting',
  {
    ...getSqliteBaseRecordTable(),

    tenantId: text('tenant_id').notNull(),
    recipientKeyFingerprint: text('recipient_key_fingerprint').notNull(),
  },
  (table) => [
    ...sqliteBaseRecordIndexes(table, 'tenantRouting'),
    foreignKey({
      columns: [table.tenantId, table.contextCorrelationId],
      foreignColumns: [tenant.id, tenant.contextCorrelationId],
    }).onDelete('cascade'),
  ]
)
