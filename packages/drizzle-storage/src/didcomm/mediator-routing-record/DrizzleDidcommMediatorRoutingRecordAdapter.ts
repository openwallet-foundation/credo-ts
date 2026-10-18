import { DidCommMediatorRoutingRecord } from '@credo-ts/didcomm'
import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

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
}
