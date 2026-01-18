import { JsonTransformer, SdJwtVcRecord } from '@credo-ts/core'

import { BaseDrizzleRecordAdapter, type DrizzleAdapterRecordValues } from '../../adapter/BaseDrizzleRecordAdapter'

import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleSdJwtVcAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['sdJwtVc']>
export class DrizzleSdJwtVcRecordAdapter extends BaseDrizzleRecordAdapter<
  SdJwtVcRecord,
  typeof postgres.sdJwtVc,
  typeof postgres,
  typeof sqlite.sdJwtVc,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.sdJwtVc, sqlite: sqlite.sdJwtVc }, SdJwtVcRecord)
  }

  public getValues(record: SdJwtVcRecord) {
    const { alg, sdAlg, vct, multiInstanceState: _, extendedVctValues, ...customTags } = record.getTags()

    return {
      alg,
      sdAlg,
      vct,
      extendedVctValues,
      credentialInstances: record.credentialInstances,
      multiInstanceState: record.multiInstanceState,
      typeMetadata: record.typeMetadata,
      typeMetadataChain: record.typeMetadataChain,
      customTags,
    }
  }

  public toRecord(values: DrizzleSdJwtVcAdapterValues): SdJwtVcRecord {
    // biome-ignore lint/correctness/noUnusedVariables: no explanation
    const { sdAlg, alg, vct, customTags, extendedVctValues, ...remainingValues } = values

    // All tags inferred from the record state itself
    const record = JsonTransformer.fromJSON(remainingValues, SdJwtVcRecord)

    return record
  }
}
