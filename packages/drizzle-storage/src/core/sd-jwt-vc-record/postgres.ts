import type { Kms, SdJwtVcRecordInstances } from '@credo-ts/core'
import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const sdJwtVc = pgTable(
  'SdJwtVc',
  {
    ...getPostgresBaseRecordTable(),

    vct: text().notNull(),

    credentialInstances: jsonb('credential_instances').$type<SdJwtVcRecordInstances>().notNull(),
    alg: text().$type<Kms.KnownJwaSignatureAlgorithm>().notNull(),
    sdAlg: text('sd_alg').$type<string>().notNull(),

    // compactSdJwtVc: text('compact_sd_jwt_vc').notNull(),
  },
  (table) => postgresBaseRecordIndexes(table, 'sdJwtVc')
)
