import { JsonTransformer, type TagsBase } from '@credo-ts/core'
import { DidCommMessageRecord } from '@credo-ts/didcomm'
import {
  BaseDrizzleRecordAdapter,
  type DrizzleAdapterRecordValues,
  type DrizzleAdapterValues,
} from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleDidcommMessageAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['didcommMessage']>
export class DrizzleDidcommMessageRecordAdapter extends BaseDrizzleRecordAdapter<
  DidCommMessageRecord,
  typeof postgres.didcommMessage,
  typeof postgres,
  typeof sqlite.didcommMessage,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.didcommMessage, sqlite: sqlite.didcommMessage }, DidCommMessageRecord)
  }

  public tagKeyMapping = {
    messageType: ['message', '@type'],
    messageId: ['message', '@id'],
  } as const

  public getValues(record: DidCommMessageRecord): DrizzleAdapterValues<(typeof sqlite)['didcommMessage']> {
    const {
      role,
      associatedRecordId,
      // biome-ignore lint/correctness/noUnusedVariables: no explanation
      messageId,
      messageName,
      // biome-ignore lint/correctness/noUnusedVariables: no explanation
      messageType,
      protocolMajorVersion,
      protocolMinorVersion,
      protocolName,
      threadId,
      ...customTags
    } = record.getTags()

    return {
      message: record.message,
      role,

      associatedRecordId,

      // These are accessed on message['@type'] and message['@id']
      // messageType,
      // messageId,

      threadId,
      protocolName,
      messageName,

      protocolMajorVersion,
      protocolMinorVersion,

      customTags,
    }
  }

  public toRecord(values: DrizzleDidcommMessageAdapterValues): DidCommMessageRecord {
    // biome-ignore lint/correctness/noUnusedVariables: no explanation
    const { customTags, messageName, protocolMajorVersion, protocolMinorVersion, protocolName, ...remainingValues } =
      values

    const record = JsonTransformer.fromJSON(remainingValues, DidCommMessageRecord)
    record.setTags(customTags as TagsBase)

    return record
  }
}
