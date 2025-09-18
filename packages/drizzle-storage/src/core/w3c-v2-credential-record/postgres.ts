import { ClaimFormat, W3cVerifiableCredential } from '@credo-ts/core'
import { jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const w3cV2CredentialClaimFormat = pgEnum('W3cV2ClaimFormat', [ClaimFormat.SdJwtW3cVc, ClaimFormat.JwtW3cVc])

export const w3cV2Credential = pgTable(
  'W3cV2Credential',
  {
    ...getPostgresBaseRecordTable(),

    credential: jsonb().$type<W3cVerifiableCredential['encoded']>().notNull(),

    // Default Tags
    issuerId: text('issuer_id').notNull(),
    subjectIds: text('subject_ids').array().notNull(),
    schemaIds: text('schema_ids').array().notNull(),
    contexts: text().array().notNull(),
    types: text().array().notNull(),
    givenId: text('given_id'),
    claimFormat: w3cV2CredentialClaimFormat('claim_format').notNull(),
    algs: text().array(),
  },
  (table) => postgresBaseRecordIndexes(table, 'w3cV2Credential')
)
