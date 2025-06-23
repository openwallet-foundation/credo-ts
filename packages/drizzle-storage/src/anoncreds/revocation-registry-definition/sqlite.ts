import type { AnonCredsRevocationRegistryDefinition } from '@credo-ts/anoncreds'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const anonCredsRevocationRegistryDefinition = sqliteTable(
  'AnonCredsRevocationRegistryDefinition',
  {
    ...getSqliteBaseRecordTable(),

    revocationRegistryDefinitionId: text('revocation_registry_definition_id').notNull().unique(),
    revocationRegistryDefinition: text('revocation_registry_definition', { mode: 'json' })
      .$type<AnonCredsRevocationRegistryDefinition>()
      .notNull(),

    // This is duplicated from the revocation registry definition. Might want to
    // dedupe by omitting that key from the json
    credentialDefinitionId: text('credential_definition_id').notNull(),
  },
  (table) => sqliteBaseRecordIndexes(table, 'anonCredsRevocationRegistryDefinition')
)
