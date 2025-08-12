import { foreignKey, pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'
import { tenant } from '../postgres'

export const tenantRouting = pgTable(
  'TenantRouting',
  {
    ...getPostgresBaseRecordTable(),

    tenantId: text('tenant_id').notNull(),
    recipientKeyFingerprint: text('recipient_key_fingerprint').notNull(),
  },
  (table) => [
    ...postgresBaseRecordIndexes(table, 'tenantRouting'),
    foreignKey({
      columns: [table.tenantId, table.contextCorrelationId],
      foreignColumns: [tenant.id, tenant.contextCorrelationId],
    }).onDelete('cascade'),
  ]
)
