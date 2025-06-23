import type { AnonCredsSchema } from '@credo-ts/anoncreds'
import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const anonCredsSchema = pgTable(
  'AnonCredsSchema',
  {
    ...getPostgresBaseRecordTable(),

    schemaId: text('schema_id').notNull().unique(),
    schema: jsonb('schema').$type<Omit<AnonCredsSchema, 'issuerId' | 'name' | 'version'>>().notNull(),

    // These are extracted from the schema JSON object, to allow for easy querying based on tags
    issuerId: text('issuer_id').notNull(),
    schemaName: text('schema_name').notNull(),
    schemaVersion: text('schema_version').notNull(),

    methodName: text('method_name').notNull(),
    unqualifiedSchemaId: text('unqualified_schema_id'),
  },
  (table) => postgresBaseRecordIndexes(table, 'anonCredsSchema')
)
