import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const anonCredsKeyCorrectnessProof = sqliteTable(
  'AnonCredsKeyCorrectnessProof',
  {
    ...getSqliteBaseRecordTable(),

    credentialDefinitionId: text('credential_definition_id').notNull().unique(),

    value: text('value', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  },
  (table) => sqliteBaseRecordIndexes(table, 'anonCredsKeyCorrectnessProof')
)
