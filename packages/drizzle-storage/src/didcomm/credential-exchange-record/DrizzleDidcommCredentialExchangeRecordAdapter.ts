import { DidCommCredentialExchangeRecord } from '@credo-ts/didcomm'
import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export class DrizzleDidcommCredentialExchangeRecordAdapter extends BaseDrizzleRecordAdapter<
  DidCommCredentialExchangeRecord,
  typeof postgres.didcommCredentialExchange,
  typeof postgres,
  typeof sqlite.didcommCredentialExchange,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(
      database,
      { postgres: postgres.didcommCredentialExchange, sqlite: sqlite.didcommCredentialExchange },
      DidCommCredentialExchangeRecord
    )
  }
}
