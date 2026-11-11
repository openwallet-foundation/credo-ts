import { DrpcRecord } from '@credo-ts/drpc'
import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

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
}
