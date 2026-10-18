import { DidCommMediationRecord } from '@credo-ts/didcomm'
import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export class DrizzleDidcommMediationRecordAdapter extends BaseDrizzleRecordAdapter<
  DidCommMediationRecord,
  typeof postgres.didcommMediation,
  typeof postgres,
  typeof sqlite.didcommMediation,
  typeof sqlite
> {
  public customTagColumns = ['default']

  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.didcommMediation, sqlite: sqlite.didcommMediation }, DidCommMediationRecord)
  }
}
