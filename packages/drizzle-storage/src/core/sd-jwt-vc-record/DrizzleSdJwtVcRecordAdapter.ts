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
    const { alg, sdAlg, vct, ...customTags } = record.getTags()

    return {
      alg,
      sdAlg,
      vct,
      credentialInstances: record.credentialInstances,
      customTags,
    }
  }

  public toRecord(values: DrizzleSdJwtVcAdapterValues): SdJwtVcRecord {
    const { sdAlg, alg, vct, customTags, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, SdJwtVcRecord)
    record.setTags({
      alg,
      vct,
      sdAlg,
      ...customTags,
    })

    return record
  }
}
