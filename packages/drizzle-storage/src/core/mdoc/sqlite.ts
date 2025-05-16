import { Kms } from '@credo-ts/core'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sqliteBaseRecordTable } from '../../sqlite'

export const mdoc = sqliteTable('Mdoc', {
  ...sqliteBaseRecordTable,

  base64Url: text('base64_url').notNull(),
  alg: text().$type<Kms.KnownJwaSignatureAlgorithm>().notNull(),
  docType: text('doc_type').notNull(),
})
