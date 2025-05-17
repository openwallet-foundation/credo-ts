import type { Kms } from '@credo-ts/core'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sqliteBaseRecordTable } from '../../sqlite'
import { sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const mdoc = sqliteTable(
  'Mdoc',
  {
    ...sqliteBaseRecordTable,

    base64Url: text('base64_url').notNull(),
    alg: text().$type<Kms.KnownJwaSignatureAlgorithm>().notNull(),
    docType: text('doc_type').notNull(),
  },
  (table) => sqliteBaseRecordIndexes(table, 'mdoc')
)
