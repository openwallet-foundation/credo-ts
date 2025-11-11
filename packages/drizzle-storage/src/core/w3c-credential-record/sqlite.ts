import type { ClaimFormat, W3cCredentialRecordInstances } from '@credo-ts/core'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const w3cCredential = sqliteTable(
  'W3cCredential',
  {
    ...getSqliteBaseRecordTable(),

    // JWT vc is string, JSON-LD vc is object
    // credential: text({ mode: 'json' }).$type<W3cVerifiableCredential['encoded']>().notNull(),

    credentialInstances: text('credential_instances', { mode: 'json' }).$type<W3cCredentialRecordInstances>().notNull(),

    // Default Tags
    issuerId: text('issuer_id').notNull(),
    subjectIds: text('subject_ids', { mode: 'json' }).$type<string[]>().notNull(),
    schemaIds: text('schema_ids', { mode: 'json' }).$type<string[]>().notNull(),
    contexts: text({ mode: 'json' }).$type<string[]>().notNull(),
    types: text({ mode: 'json' }).$type<string[]>().notNull(),
    givenId: text('given_id'),
    claimFormat: text('claim_format').$type<ClaimFormat.LdpVc | ClaimFormat.JwtVc>().notNull(),
    proofTypes: text('proof_types', { mode: 'json' }).$type<string[]>(),
    cryptosuites: text('crypto_suites', { mode: 'json' }).$type<string[]>(),
    algs: text({ mode: 'json' }).$type<string[]>(),

    // Custom Tags
    expandedTypes: text('expanded_types', { mode: 'json' }).$type<string[]>(),
  },
  (table) => sqliteBaseRecordIndexes(table, 'w3cCredential')
)
