import { JsonTransformer, type TagsBase } from '@credo-ts/core'

import { BaseDrizzleRecordAdapter, type DrizzleAdapterRecordValues } from '../../adapter/BaseDrizzleRecordAdapter'

import { DidCommConnectionRecord } from '@credo-ts/didcomm'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleDidcommConnectionAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['didcommConnection']>
export class DrizzleDidcommConnectionRecordAdapter extends BaseDrizzleRecordAdapter<
  DidCommConnectionRecord,
  typeof postgres.didcommConnection,
  typeof postgres,
  typeof sqlite.didcommConnection,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.didcommConnection, sqlite: sqlite.didcommConnection }, DidCommConnectionRecord)
  }

  public getValues(record: DidCommConnectionRecord) {
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

  public toRecord(values: DrizzleDidcommConnectionAdapterValues): DidCommConnectionRecord {
    const { customTags, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, DidCommConnectionRecord)
    record.setTags(customTags as TagsBase)

    return record
  }
}
