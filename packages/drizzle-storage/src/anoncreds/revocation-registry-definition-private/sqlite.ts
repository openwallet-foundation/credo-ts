import { AnonCredsRevocationRegistryState } from '@credo-ts/anoncreds'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sqliteBaseRecordTable } from '../../sqlite'
import { sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const anonCredsRevocationRegistryDefinitionPrivate = sqliteTable(
  'AnonCredsRevocationRegistryDefinitionPrivate',
  {
    ...sqliteBaseRecordTable,

    state: text('state').$type<AnonCredsRevocationRegistryState>().notNull(),

    revocationRegistryDefinitionId: text('revocation_registry_definition_id').notNull().unique(),
    credentialDefinitionId: text('credential_definition_id').notNull(),

    value: text('value', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  },
  (table) => sqliteBaseRecordIndexes(table, 'anonCredsRevocationRegistryDefinitionPrivate')
)
