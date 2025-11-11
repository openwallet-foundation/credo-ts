import type { Kms, SdJwtVcRecordInstances } from '@credo-ts/core'
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

    // compactSdJwtVc: text('compact_sd_jwt_vc').notNull(),
  },
  (table) => sqliteBaseRecordIndexes(table, 'sdJwtVc')
)
