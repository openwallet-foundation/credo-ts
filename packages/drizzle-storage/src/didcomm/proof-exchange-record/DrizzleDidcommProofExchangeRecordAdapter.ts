import { DidCommProofExchangeRecord } from '@credo-ts/didcomm'
import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export class DrizzleDidcommProofExchangeRecordAdapter extends BaseDrizzleRecordAdapter<
  DidCommProofExchangeRecord,
  typeof postgres.didcommProofExchange,
  typeof postgres,
  typeof sqlite.didcommProofExchange,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(
      database,
      { postgres: postgres.didcommProofExchange, sqlite: sqlite.didcommProofExchange },
      DidCommProofExchangeRecord
    )
  }
}
