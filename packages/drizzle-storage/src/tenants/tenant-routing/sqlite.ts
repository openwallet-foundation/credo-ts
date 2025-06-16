import { foreignKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sqliteBaseRecordTable } from '../../sqlite'
import { sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'
import { tenant } from '../sqlite'

export const tenantRouting = sqliteTable(
  'TenantRouting',
  {
    ...sqliteBaseRecordTable,

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
