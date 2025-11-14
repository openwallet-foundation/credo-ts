import type { Kms, MdocRecordInstances } from '@credo-ts/core'
import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'
import { credentialMultiInstanceStateEnum } from '../w3c-credential-record/postgres'

export const mdoc = pgTable(
  'Mdoc',
  {
    ...getPostgresBaseRecordTable(),

    credentialInstances: jsonb('credential_instances').$type<MdocRecordInstances>().notNull(),

    alg: text().$type<Kms.KnownJwaSignatureAlgorithm>().notNull(),
    docType: text('doc_type').notNull(),

    multiInstanceState: credentialMultiInstanceStateEnum('multi_instance_state')
      .notNull()
      .default('SingleInstanceUsed'),
  },
  (table) => postgresBaseRecordIndexes(table, 'mdoc')
)
