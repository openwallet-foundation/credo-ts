import { Kms } from '@credo-ts/core'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { postgresBaseRecordTable } from '../../postgres'

export const mdoc = pgTable('Mdoc', {
  ...postgresBaseRecordTable,

  base64Url: text('base64_url').notNull(),
  alg: text().$type<Kms.KnownJwaSignatureAlgorithm>().notNull(),
  docType: text('doc_type').notNull(),
})
