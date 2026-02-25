import type { AnonCredsCredential } from '@credo-ts/anoncreds'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const anonCredsCredential = sqliteTable(
  'AnonCredsCredential',
  {
    ...getSqliteBaseRecordTable(),

    credentialId: text('credential_id').notNull(),
    credentialRevocationId: text('credential_revocation_id'),
    linkSecretId: text('link_secret_id').notNull(),
    credential: text('credential', { mode: 'json' })
      .$type<Omit<AnonCredsCredential, 'schema_id' | 'cred_def_id' | 'rev_reg_id'>>()
      .notNull(),
    methodName: text('method_name').notNull(),

    credentialDefinitionId: text('credential_definition_id').notNull(),
    revocationRegistryId: text('revocation_registry_id'),
    schemaId: text('schema_id').notNull(),
    schemaName: text('schema_name').notNull(),
    schemaVersion: text('schema_version').notNull(),
    schemaIssuerId: text('schema_issuer_id').notNull(),
    issuerId: text('issuer_id').notNull(),
  },
  (table) => sqliteBaseRecordIndexes(table, 'anonCredsCredential')
)
