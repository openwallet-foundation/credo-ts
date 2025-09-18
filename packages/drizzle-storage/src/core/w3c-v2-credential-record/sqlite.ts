import type { ClaimFormat, W3cV2VerifiableCredential } from '@credo-ts/core'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const w3cV2Credential = sqliteTable(
  'W3cV2Credential',
  {
    ...getSqliteBaseRecordTable(),

    credential: text({ mode: 'json' }).$type<W3cV2VerifiableCredential['encoded']>().notNull(),

    // Default Tags
    issuerId: text('issuer_id').notNull(),
    subjectIds: text('subject_ids', { mode: 'json' }).$type<string[]>().notNull(),
    schemaIds: text('schema_ids', { mode: 'json' }).$type<string[]>().notNull(),
    contexts: text({ mode: 'json' }).$type<string[]>().notNull(),
    types: text({ mode: 'json' }).$type<string[]>().notNull(),
    givenId: text('given_id'),
    claimFormat: text('claim_format').$type<ClaimFormat.SdJwtW3cVc | ClaimFormat.JwtW3cVc>().notNull(),
    algs: text({ mode: 'json' }).$type<string[]>(),
  },
  (table) => sqliteBaseRecordIndexes(table, 'w3cV2Credential')
)
