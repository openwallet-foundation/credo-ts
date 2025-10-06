import { JsonTransformer } from '@credo-ts/core'

import {
  BaseDrizzleRecordAdapter,
  DrizzleAdapterRecordValues,
  DrizzleAdapterValues,
} from '../../adapter/BaseDrizzleRecordAdapter'

import { DidCommMediationRecord } from '@credo-ts/didcomm'
import { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleDidcommMediationAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['didcommMediation']>
export class DrizzleDidcommMediationRecordAdapter extends BaseDrizzleRecordAdapter<
  DidCommMediationRecord,
  typeof postgres.didcommMediation,
  typeof postgres,
  typeof sqlite.didcommMediation,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.didcommMediation, sqlite: sqlite.didcommMediation }, DidCommMediationRecord)
  }

  public getValues(record: DidCommMediationRecord): DrizzleAdapterValues<(typeof sqlite)['didcommMediation']> {
    const { connectionId, recipientKeys, role, state, threadId, default: defaultTag, ...customTags } = record.getTags()

    return {
      connectionId,
      recipientKeys,
      role,
      state,
      threadId,
      default: defaultTag,
      routingKeys: record.routingKeys,
      endpoint: record.endpoint,
      pickupStrategy: record.pickupStrategy,
      customTags,
    }
  }

  public toRecord(values: DrizzleDidcommMediationAdapterValues): DidCommMediationRecord {
    const { customTags, default: defaultTag, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, DidCommMediationRecord)
    record.setTags({ ...customTags, default: defaultTag ?? undefined })

    return record
  }
}
