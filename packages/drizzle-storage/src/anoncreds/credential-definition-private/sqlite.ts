import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sqliteBaseRecordTable } from '../../sqlite'
import { sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const anonCredsCredentialDefinitionPrivate = sqliteTable(
  'AnonCredsCredentialDefinitionPrivate',
  {
    ...sqliteBaseRecordTable,

    credentialDefinitionId: text('credential_definition_id').notNull().unique(),

    value: text('value', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  },
  (table) => sqliteBaseRecordIndexes(table, 'anonCredsCredentialDefinitionPrivate')
)
