import { DidCommMessageRecord } from '@credo-ts/didcomm'
import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

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
}
