import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'

import type { OpenId4VpVerifierClientMetadata } from '@credo-ts/openid4vc'

export const openid4vcVerifier = pgTable(
  'Openid4vcVerifier',
  {
    ...getPostgresBaseRecordTable(),
    verifierId: text('verifier_id').unique().notNull(),
    clientMetadata: jsonb('client_metadata').$type<OpenId4VpVerifierClientMetadata>(),
  },
  (table) => postgresBaseRecordIndexes(table, 'openid4vcVerifier')
)
