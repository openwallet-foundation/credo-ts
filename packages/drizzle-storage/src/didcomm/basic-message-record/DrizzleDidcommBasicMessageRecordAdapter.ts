import { JsonTransformer, TagsBase } from '@credo-ts/core'

import {
  BaseDrizzleRecordAdapter,
  DrizzleAdapterRecordValues,
  DrizzleAdapterValues,
} from '../../adapter/BaseDrizzleRecordAdapter'

import { DidCommBasicMessageRecord } from '@credo-ts/didcomm'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleDidcommBasicMessageAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['didcommBasicMessage']>
export class DrizzleDidcommBasicMessageRecordAdapter extends BaseDrizzleRecordAdapter<
  DidCommBasicMessageRecord,
  typeof postgres.didcommBasicMessage,
  typeof postgres,
  typeof sqlite.didcommBasicMessage,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(
      database,
      { postgres: postgres.didcommBasicMessage, sqlite: sqlite.didcommBasicMessage },
      DidCommBasicMessageRecord
    )
  }

  public getValues(record: DidCommBasicMessageRecord): DrizzleAdapterValues<(typeof sqlite)['didcommBasicMessage']> {
    const { role, connectionId, parentThreadId, threadId, ...customTags } = record.getTags()

    return {
      content: record.content,
      sentTime: record.sentTime,

      connectionId,
      role,
      threadId,
      parentThreadId,

      customTags,
    }
  }

  public toRecord(values: DrizzleDidcommBasicMessageAdapterValues): DidCommBasicMessageRecord {
    const { customTags, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, DidCommBasicMessageRecord)
    record.setTags(customTags as TagsBase)

    return record
  }
}
