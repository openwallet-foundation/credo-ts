import type { AnonCredsCredentialDefinition } from '@credo-ts/anoncreds'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const anonCredsCredentialDefinition = sqliteTable(
  'AnonCredsCredentialDefinition',
  {
    ...getSqliteBaseRecordTable(),

    credentialDefinitionId: text('credential_definition_id').notNull().unique(),
    credentialDefinition: text('credential_definition', { mode: 'json' })
      .$type<Omit<AnonCredsCredentialDefinition, 'issuerId' | 'schemaId' | 'tag'>>()
      .notNull(),
    methodName: text('method_name').notNull(),

    // These are extracted from the credential definition JSON object, to allow for easy querying based on tags
    schemaId: text('schema_id').notNull(),
    issuerId: text('issuer_id').notNull(),
    tag: text('tag').notNull(),
    unqualifiedCredentialDefinitionId: text('unqualified_credential_definition_id'),
  },
  (table) => sqliteBaseRecordIndexes(table, 'anonCredsCredentialDefinition')
)
