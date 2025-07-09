import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const anonCredsCredentialDefinitionPrivate = pgTable(
  'AnonCredsCredentialDefinitionPrivate',
  {
    ...getPostgresBaseRecordTable(),

    credentialDefinitionId: text('credential_definition_id').notNull().unique(),

    value: jsonb('value').$type<Record<string, unknown>>().notNull(),
  },
  (table) => postgresBaseRecordIndexes(table, 'anonCredsCredentialDefinitionPrivate')
)
