import type { Kms, MdocRecordInstances } from '@credo-ts/core'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const mdoc = sqliteTable(
  'Mdoc',
  {
    ...getSqliteBaseRecordTable(),

    // base64Url: text('base64_url').notNull(),

    credentialInstances: text('credential_instances', { mode: 'json' }).$type<MdocRecordInstances>().notNull(),
    alg: text().$type<Kms.KnownJwaSignatureAlgorithm>().notNull(),
    docType: text('doc_type').notNull(),
  },
  (table) => sqliteBaseRecordIndexes(table, 'mdoc')
)
