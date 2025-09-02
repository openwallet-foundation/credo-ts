import type { AnonCredsCredentialDefinition } from '@credo-ts/anoncreds'
import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const anonCredsCredentialDefinition = pgTable(
  'AnonCredsCredentialDefinition',
  {
    ...getPostgresBaseRecordTable(),

    credentialDefinitionId: text('credential_definition_id').notNull().unique(),
    credentialDefinition: jsonb('credential_definition')
      .$type<Omit<AnonCredsCredentialDefinition, 'issuerId' | 'schemaId' | 'tag'>>()
      .notNull(),
    methodName: text('method_name').notNull(),

    // These are extracted from the credential definition JSON object, to allow for easy querying based on tags
    schemaId: text('schema_id').notNull(),
    issuerId: text('issuer_id').notNull(),
    tag: text('tag').notNull(),
    unqualifiedCredentialDefinitionId: text('unqualified_credential_definition_id'),
  },
  (table) => postgresBaseRecordIndexes(table, 'anonCredsCredentialDefinition')
)
