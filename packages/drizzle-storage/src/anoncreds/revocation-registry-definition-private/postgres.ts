import { AnonCredsRevocationRegistryState } from '@credo-ts/anoncreds'
import { jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { postgresBaseRecordTable } from '../../postgres'
import { postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const anonCredsRevocationRegistryStateEnum = pgEnum(
  'AnonCredsRevocationRegistryState',
  AnonCredsRevocationRegistryState
)

export const anonCredsRevocationRegistryDefinitionPrivate = pgTable(
  'AnonCredsRevocationRegistryDefinitionPrivate',
  {
    ...postgresBaseRecordTable,
    state: anonCredsRevocationRegistryStateEnum('state').notNull(),

    revocationRegistryDefinitionId: text('revocation_registry_definition_id').notNull().unique(),
    credentialDefinitionId: text('credential_definition_id').notNull(),

    value: jsonb('value').$type<Record<string, unknown>>().notNull(),
  },
  (table) => postgresBaseRecordIndexes(table, 'anonCredsRevocationRegistryDefinitionPrivate')
)
