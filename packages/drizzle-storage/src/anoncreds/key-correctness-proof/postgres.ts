import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const anonCredsKeyCorrectnessProof = pgTable(
  'AnonCredsKeyCorrectnessProof',
  {
    ...getPostgresBaseRecordTable(),

    credentialDefinitionId: text('credential_definition_id').notNull().unique(),
    value: jsonb('value').$type<Record<string, unknown>>().notNull(),
  },
  (table) => postgresBaseRecordIndexes(table, 'anonCredsKeyCorrectnessProof')
)
