import { JsonTransformer, type TagsBase } from '@credo-ts/core'
import { DrpcRecord } from '@credo-ts/drpc'
import { BaseDrizzleRecordAdapter, type DrizzleAdapterRecordValues } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleDidcommDrpcAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['didcommDrpc']>
export class DrizzleDidcommDrpcRecordAdapter extends BaseDrizzleRecordAdapter<
  DrpcRecord,
  typeof postgres.didcommDrpc,
  typeof postgres,
  typeof sqlite.didcommDrpc,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.didcommDrpc, sqlite: sqlite.didcommDrpc }, DrpcRecord)
  }

  public getValues(record: DrpcRecord) {
    const { connectionId, threadId, ...customTags } = record.getTags()

    return {
      threadId,
      connectionId,
      state: record.state,
      role: record.role,
      request: record.request,
      response: record.response,
      customTags,
    }
  }

  public toRecord(values: DrizzleDidcommDrpcAdapterValues): DrpcRecord {
    const { customTags, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, DrpcRecord)
    if (customTags) record.setTags(customTags as TagsBase)

    return record
  }
}
