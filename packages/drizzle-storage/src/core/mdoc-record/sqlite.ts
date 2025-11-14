import type { CredentialMultiInstanceState, Kms, MdocRecordInstances } from '@credo-ts/core'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const mdoc = sqliteTable(
  'Mdoc',
  {
    ...getSqliteBaseRecordTable(),

    credentialInstances: text('credential_instances', { mode: 'json' }).$type<MdocRecordInstances>().notNull(),
    alg: text().$type<Kms.KnownJwaSignatureAlgorithm>().notNull(),
    docType: text('doc_type').notNull(),

    multiInstanceState: text('multi_instance_state')
      .$type<CredentialMultiInstanceState>()
      .notNull()
      .default('SingleInstanceUsed' satisfies `${CredentialMultiInstanceState}` as CredentialMultiInstanceState),
  },
  (table) => sqliteBaseRecordIndexes(table, 'mdoc')
)
