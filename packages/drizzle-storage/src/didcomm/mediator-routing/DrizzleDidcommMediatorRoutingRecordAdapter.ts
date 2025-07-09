import { JsonTransformer, TagsBase } from '@credo-ts/core'

import {
  BaseDrizzleRecordAdapter,
  DrizzleAdapterRecordValues,
  DrizzleAdapterValues,
} from '../../adapter/BaseDrizzleRecordAdapter'

import { MediatorRoutingRecord } from '@credo-ts/didcomm'
import { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleDidcommMediatorRoutingAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['didcommMediatorRouting']>
export class DrizzleDidcommMediatorRoutingRecordAdapter extends BaseDrizzleRecordAdapter<
  MediatorRoutingRecord,
  typeof postgres.didcommMediatorRouting,
  typeof postgres,
  typeof sqlite.didcommMediatorRouting,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(
      database,
      { postgres: postgres.didcommMediatorRouting, sqlite: sqlite.didcommMediatorRouting },
      'MediatorRoutingRecord'
    )
  }

  public getValues(record: MediatorRoutingRecord): DrizzleAdapterValues<(typeof sqlite)['didcommMediatorRouting']> {
    const { routingKeyFingerprints, ...customTags } = record.getTags()

    return {
      routingKeyFingerprints,
      routingKeys: record.routingKeys,

      customTags,
    }
  }

  public toRecord(values: DrizzleDidcommMediatorRoutingAdapterValues): MediatorRoutingRecord {
    const { customTags, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, MediatorRoutingRecord)
    record.setTags(customTags as TagsBase)

    return record
  }
}
