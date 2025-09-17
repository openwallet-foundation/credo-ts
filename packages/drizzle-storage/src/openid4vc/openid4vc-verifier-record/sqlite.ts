import { OpenId4VpVerifierClientMetadata } from '@credo-ts/openid4vc'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const openid4vcVerifier = sqliteTable(
  'Openid4vcVerifier',
  {
    ...getSqliteBaseRecordTable(),

    // NOTE: generally we don't have unique constraints on single fields,
    // (always in combination with the context correlation id), but for verifier
    // id, it will actually cause issues, since we use the verifierId in the public
    // url and map that to the context correlation id.
    verifierId: text('verifier_id').unique().notNull(),

    clientMetadata: text('client_metadata', { mode: 'json' }).$type<OpenId4VpVerifierClientMetadata>(),
  },
  (table) => sqliteBaseRecordIndexes(table, 'openid4vcVerifier')
)
