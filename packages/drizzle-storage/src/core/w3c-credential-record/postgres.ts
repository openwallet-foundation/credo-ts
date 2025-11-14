import type { ClaimFormat, CredentialMultiInstanceState, W3cCredentialRecordInstances } from '@credo-ts/core'
import { jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'
import { exhaustiveArray } from '../../util'

export const w3cCredentialClaimFormat = pgEnum('W3cClaimFormat', [
  'ldp_vc' satisfies `${ClaimFormat.LdpVc}`,
  'jwt_vc' satisfies `${ClaimFormat.JwtVc}`,
])

const credentialMultiInstanceStates = exhaustiveArray(
  {} as CredentialMultiInstanceState,
  ['SingleInstanceUsed', 'SingleInstanceUnused', 'MultiInstanceFirstUsed', 'MultiInstanceFirstUnused'] as const
)
export const credentialMultiInstanceStateEnum = pgEnum('CredentialMultiInstanceState', credentialMultiInstanceStates)

export const w3cCredential = pgTable(
  'W3cCredential',
  {
    ...getPostgresBaseRecordTable(),

    // JWT vc is string, JSON-LD vc is object

    credentialInstances: jsonb('credential_instances').$type<W3cCredentialRecordInstances>().notNull(),

    // Default Tags
    issuerId: text('issuer_id').notNull(),
    subjectIds: text('subject_ids').array().notNull(),
    schemaIds: text('schema_ids').array().notNull(),
    contexts: text().array().notNull(),
    types: text().array().notNull(),
    givenId: text('given_id'),
    claimFormat: w3cCredentialClaimFormat('claim_format').notNull(),
    proofTypes: text('proof_types').array(),
    cryptosuites: text('crypto_suites').array(),
    algs: text().array(),

    // Custom Tags
    expandedTypes: text('expanded_types').array(),

    multiInstanceState: credentialMultiInstanceStateEnum('multi_instance_state')
      .notNull()
      .default('SingleInstanceUsed'),
  },
  (table) => postgresBaseRecordIndexes(table, 'w3cCredential')
)
