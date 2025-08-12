import { JsonTransformer, TagsBase } from '@credo-ts/core'

import {
  BaseDrizzleRecordAdapter,
  DrizzleAdapterRecordValues,
  DrizzleAdapterValues,
} from '../../adapter/BaseDrizzleRecordAdapter'

import { DidCommMessageRecord } from '@credo-ts/didcomm'
import { DrizzleDatabase } from '../../DrizzleDatabase'
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
    super(database, { postgres: postgres.didcommMessage, sqlite: sqlite.didcommMessage }, 'DidCommMessageRecord')
  }

  public tagKeyMapping = {
    messageType: ['message', '@type'],
    messageId: ['message', '@id'],
  } as const

  public getValues(record: DidCommMessageRecord): DrizzleAdapterValues<(typeof sqlite)['didcommMessage']> {
    const {
      role,
      associatedRecordId,
      messageId,
      messageName,
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

      // These are access on message['@type'] and message['@id']
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
    const { customTags, messageName, protocolMajorVersion, protocolMinorVersion, protocolName, ...remainingValues } =
      values

    const record = JsonTransformer.fromJSON(remainingValues, DidCommMessageRecord)
    record.setTags(customTags as TagsBase)

    return record
  }
}
