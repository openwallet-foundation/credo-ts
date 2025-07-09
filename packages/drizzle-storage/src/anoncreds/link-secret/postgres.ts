import { boolean, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const anonCredsLinkSecret = pgTable(
  'AnonCredsLinkSecret',
  {
    ...getPostgresBaseRecordTable(),

    linkSecretId: text('link_secret_id').notNull(),
    isDefault: boolean('is_default').notNull().default(false),

    value: text('value'),
  },
  (table) => [
    ...postgresBaseRecordIndexes(table, 'anonCredsLinkSecret'),
    uniqueIndex('link_secret_id_context_correlation_id_unique').on(table.linkSecretId, table.contextCorrelationId),
  ]
)
