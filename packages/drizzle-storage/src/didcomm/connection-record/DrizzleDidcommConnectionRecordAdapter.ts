import { JsonTransformer, TagsBase } from '@credo-ts/core'

import { BaseDrizzleRecordAdapter, DrizzleAdapterRecordValues } from '../../adapter/BaseDrizzleRecordAdapter'

import { ConnectionRecord } from '@credo-ts/didcomm'
import { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleDidcommConnectionAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['didcommConnection']>
export class DrizzleDidcommConnectionRecordAdapter extends BaseDrizzleRecordAdapter<
  ConnectionRecord,
  typeof postgres.didcommConnection,
  typeof postgres,
  typeof sqlite.didcommConnection,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.didcommConnection, sqlite: sqlite.didcommConnection }, ConnectionRecord)
  }

  public getValues(record: ConnectionRecord) {
    const {
      state,
      role,
      threadId,
      mediatorId,
      did,
      theirDid,
      outOfBandId,
      invitationDid,
      connectionTypes,
      previousDids,
      previousTheirDids,
      ...customTags
    } = record.getTags()

    return {
      state,
      role,
      threadId,
      mediatorId,
      did,
      theirDid,
      outOfBandId,
      invitationDid,
      connectionTypes,
      previousDids,
      previousTheirDids,
      alias: record.alias,
      autoAcceptConnection: record.autoAcceptConnection,
      errorMessage: record.errorMessage,
      imageUrl: record.imageUrl,
      theirLabel: record.theirLabel,
      protocol: record.protocol,
      // TOOD: Fix types
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      customTags: customTags as any,
    }
  }

  public toRecord(values: DrizzleDidcommConnectionAdapterValues): ConnectionRecord {
    const { customTags, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, ConnectionRecord)
    record.setTags(customTags as TagsBase)

    return record
  }
}
