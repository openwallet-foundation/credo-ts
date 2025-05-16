import { Kms } from '@credo-ts/core'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { baseRecordTable } from '../../postgres/baseRecord'

export const sdJwtVc = pgTable('SdJwtVc', {
  ...baseRecordTable,

  vct: text().notNull(),
  alg: text().$type<Kms.KnownJwaSignatureAlgorithm>().notNull(),
  sdAlg: text('sd_alg').$type<string>().notNull(),

  compactSdJwtVc: text('compact_sd_jwt_vc').notNull(),
})
