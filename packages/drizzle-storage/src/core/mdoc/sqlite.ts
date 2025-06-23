import type { Kms } from '@credo-ts/core'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const mdoc = sqliteTable(
  'Mdoc',
  {
    ...getSqliteBaseRecordTable(),

    base64Url: text('base64_url').notNull(),
    alg: text().$type<Kms.KnownJwaSignatureAlgorithm>().notNull(),
    docType: text('doc_type').notNull(),
  },
  (table) => sqliteBaseRecordIndexes(table, 'mdoc')
)
