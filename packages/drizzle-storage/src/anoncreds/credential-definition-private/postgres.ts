import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { postgresBaseRecordTable } from '../../postgres'
import { postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const anonCredsCredentialDefinitionPrivate = pgTable(
  'AnonCredsCredentialDefinitionPrivate',
  {
    ...postgresBaseRecordTable,

    credentialDefinitionId: text('credential_definition_id').notNull().unique(),

    value: jsonb('value').$type<Record<string, unknown>>().notNull(),
  },
  (table) => postgresBaseRecordIndexes(table, 'anonCredsCredentialDefinitionPrivate')
)
