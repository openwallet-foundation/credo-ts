import type {
  CredentialMultiInstanceState,
  Kms,
  NonEmptyArray,
  SdJwtVcRecordInstances,
  SdJwtVcTypeMetadata,
} from '@credo-ts/core'
import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { getSqliteBaseRecordTable, sqliteBaseRecordIndexes } from '../../sqlite/baseRecord'

export const sdJwtVc = sqliteTable(
  'SdJwtVc',
  {
    ...getSqliteBaseRecordTable(),

    vct: text().notNull(),
    extendedVctValues: text('extended_vct_values', { mode: 'json' }).$type<string[]>(),

    credentialInstances: text('credential_instances', { mode: 'json' }).$type<SdJwtVcRecordInstances>().notNull(),
    alg: text().$type<Kms.KnownJwaSignatureAlgorithm>().notNull(),
    sdAlg: text('sd_alg').$type<string>().notNull(),

    multiInstanceState: text('multi_instance_state')
      .$type<CredentialMultiInstanceState>()
      .notNull()
      .default('SingleInstanceUsed' satisfies `${CredentialMultiInstanceState}` as CredentialMultiInstanceState),

    typeMetadata: text('type_metadata', { mode: 'json' }).$type<SdJwtVcTypeMetadata>(),
    typeMetadataChain: text('type_metadata_chain', { mode: 'json' }).$type<NonEmptyArray<SdJwtVcTypeMetadata>>(),
  },
  (table) => sqliteBaseRecordIndexes(table, 'sdJwtVc')
)
