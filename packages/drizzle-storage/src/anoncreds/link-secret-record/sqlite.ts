import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const anonCredsLinkSecret = sqliteTable(
  'AnonCredsLinkSecret',
  {
    ...getSqliteBaseRecordTable(),

    linkSecretId: text('link_secret_id').notNull(),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),

    value: text('value'),
  },
  (table) => [
    ...sqliteBaseRecordIndexes(table, 'anonCredsLinkSecret'),
    uniqueIndex('link_secret_id_context_correlation_id_unique').on(table.linkSecretId, table.contextCorrelationId),
  ]
)
