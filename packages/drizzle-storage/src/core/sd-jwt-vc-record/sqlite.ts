import type { CredentialMultiInstanceState, Kms, SdJwtVcRecordInstances } from '@credo-ts/core'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const sdJwtVc = sqliteTable(
  'SdJwtVc',
  {
    ...getSqliteBaseRecordTable(),

    vct: text().notNull(),

    credentialInstances: text('credential_instances', { mode: 'json' }).$type<SdJwtVcRecordInstances>().notNull(),
    alg: text().$type<Kms.KnownJwaSignatureAlgorithm>().notNull(),
    sdAlg: text('sd_alg').$type<string>().notNull(),

    multiInstanceState: text('multi_instance_state')
      .$type<CredentialMultiInstanceState>()
      .notNull()
      .default('SingleInstanceUsed' satisfies `${CredentialMultiInstanceState}` as CredentialMultiInstanceState),
  },
  (table) => sqliteBaseRecordIndexes(table, 'sdJwtVc')
)
