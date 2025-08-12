import type { AnonCredsCredential } from '@credo-ts/anoncreds'
import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const anonCredsCredential = pgTable(
  'AnonCredsCredential',
  {
    ...getPostgresBaseRecordTable(),

    credentialId: text('credential_id').notNull().unique(),
    credentialRevocationId: text('credential_revocation_id'),
    linkSecretId: text('link_secret_id').notNull(),
    credential: jsonb('credential')
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
  (table) => postgresBaseRecordIndexes(table, 'anonCredsCredential')
)
