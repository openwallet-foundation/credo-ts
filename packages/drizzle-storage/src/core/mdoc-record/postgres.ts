import type { Kms, MdocRecordInstances } from '@credo-ts/core'
import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'

export const mdoc = pgTable(
  'Mdoc',
  {
    ...getPostgresBaseRecordTable(),

    // base64Url: text('base64_url').notNull(),

    credentialInstances: jsonb('credential_instances').$type<MdocRecordInstances>().notNull(),

    alg: text().$type<Kms.KnownJwaSignatureAlgorithm>().notNull(),
    docType: text('doc_type').notNull(),
  },
  (table) => postgresBaseRecordIndexes(table, 'mdoc')
)
