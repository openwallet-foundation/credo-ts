import { DidCommBasicMessageRecord } from '@credo-ts/didcomm'
import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

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
}
