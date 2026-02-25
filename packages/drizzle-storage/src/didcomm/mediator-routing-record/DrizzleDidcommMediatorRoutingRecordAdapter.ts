import { JsonTransformer, type TagsBase } from '@credo-ts/core'
import { DidCommMediatorRoutingRecord } from '@credo-ts/didcomm'
import {
  BaseDrizzleRecordAdapter,
  type DrizzleAdapterRecordValues,
  type DrizzleAdapterValues,
} from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleDidcommMediatorRoutingAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['didcommMediatorRouting']>
export class DrizzleDidcommMediatorRoutingRecordAdapter extends BaseDrizzleRecordAdapter<
  DidCommMediatorRoutingRecord,
  typeof postgres.didcommMediatorRouting,
  typeof postgres,
  typeof sqlite.didcommMediatorRouting,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(
      database,
      { postgres: postgres.didcommMediatorRouting, sqlite: sqlite.didcommMediatorRouting },
      DidCommMediatorRoutingRecord
    )
  }

  public getValues(
    record: DidCommMediatorRoutingRecord
  ): DrizzleAdapterValues<(typeof sqlite)['didcommMediatorRouting']> {
    const { routingKeyFingerprints, ...customTags } = record.getTags()

    return {
      routingKeyFingerprints,
      routingKeys: record.routingKeys,

      customTags,
    }
  }

  public toRecord(values: DrizzleDidcommMediatorRoutingAdapterValues): DidCommMediatorRoutingRecord {
    const { customTags, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, DidCommMediatorRoutingRecord)
    record.setTags(customTags as TagsBase)

    return record
  }
}
