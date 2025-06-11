import type { AnonCredsRevocationRegistryDefinition } from '@credo-ts/anoncreds'
import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { postgresBaseRecordTable } from '../../postgres'
import { postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const anonCredsRevocationRegistryDefinition = pgTable(
  'AnonCredsRevocationRegistryDefinition',
  {
    ...postgresBaseRecordTable,

    revocationRegistryDefinitionId: text('revocation_registry_definition_id').notNull().unique(),
    credentialDefinitionId: text('credential_definition_id').notNull(),

    revocationRegistryDefinition: jsonb('revocation_registry_definition')
      .$type<AnonCredsRevocationRegistryDefinition>()
      .notNull(),
  },
  (table) => postgresBaseRecordIndexes(table, 'anonCredsRevocationRegistryDefinition')
)
