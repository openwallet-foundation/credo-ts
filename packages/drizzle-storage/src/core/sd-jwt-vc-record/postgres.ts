import type { Kms, NonEmptyArray, SdJwtVcRecordInstances, SdJwtVcTypeMetadata } from '@credo-ts/core'
import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { getPostgresBaseRecordTable, postgresBaseRecordIndexes } from '../../postgres/baseRecord'
import { credentialMultiInstanceStateEnum } from '../w3c-credential-record/postgres'

export const sdJwtVc = pgTable(
  'SdJwtVc',
  {
    ...getPostgresBaseRecordTable(),

    vct: text().notNull(),
    extendedVctValues: jsonb('extended_vct_values').$type<string[]>(),

    credentialInstances: jsonb('credential_instances').$type<SdJwtVcRecordInstances>().notNull(),
    alg: text().$type<Kms.KnownJwaSignatureAlgorithm>().notNull(),
    sdAlg: text('sd_alg').$type<string>().notNull(),

    multiInstanceState: credentialMultiInstanceStateEnum('multi_instance_state')
      .notNull()
      .default('SingleInstanceUsed'),

    typeMetadata: jsonb('type_metadata').$type<SdJwtVcTypeMetadata>(),
    typeMetadataChain: jsonb('type_metadata_chain').$type<NonEmptyArray<SdJwtVcTypeMetadata>>(),
  },
  (table) => postgresBaseRecordIndexes(table, 'sdJwtVc')
)
