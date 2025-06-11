import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sqliteBaseRecordTable } from '../../sqlite'
import { sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const anonCredsKeyCorrectnessProof = sqliteTable(
  'AnonCredsKeyCorrectnessProof',
  {
    ...sqliteBaseRecordTable,

    credentialDefinitionId: text('credential_definition_id').notNull().unique(),

    value: text('value', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  },
  (table) => sqliteBaseRecordIndexes(table, 'anonCredsKeyCorrectnessProof')
)
