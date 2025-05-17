import type { Kms } from '@credo-ts/core'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { postgresBaseRecordTable } from '../../postgres'
import { postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const mdoc = pgTable(
  'Mdoc',
  {
    ...postgresBaseRecordTable,

    base64Url: text('base64_url').notNull(),
    alg: text().$type<Kms.KnownJwaSignatureAlgorithm>().notNull(),
    docType: text('doc_type').notNull(),
  },
  (table) => postgresBaseRecordIndexes(table, 'mdoc')
)
