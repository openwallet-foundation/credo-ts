import type { AnonCredsSchema } from '@credo-ts/anoncreds'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const anonCredsSchema = sqliteTable(
  'AnonCredsSchema',
  {
    ...getSqliteBaseRecordTable(),

    schemaId: text('schema_id').notNull().unique(),
    schema: text({ mode: 'json' }).$type<Omit<AnonCredsSchema, 'issuerId' | 'name' | 'version'>>().notNull(),

    // These are extracted from the schema JSON object, to allow for easy querying based on tags
    issuerId: text('issuer_id').notNull(),
    schemaName: text('schema_name').notNull(),
    schemaVersion: text('schema_version').notNull(),

    methodName: text('method_name').notNull(),
    unqualifiedSchemaId: text('unqualified_schema_id'),
  },
  (table) => sqliteBaseRecordIndexes(table, 'anonCredsSchema')
)
