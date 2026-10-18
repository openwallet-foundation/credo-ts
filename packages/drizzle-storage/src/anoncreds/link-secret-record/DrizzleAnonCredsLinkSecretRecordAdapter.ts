import { AnonCredsLinkSecretRecord } from '@credo-ts/anoncreds'
import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export class DrizzleAnonCredsLinkSecretRecordAdapter extends BaseDrizzleRecordAdapter<
  AnonCredsLinkSecretRecord,
  typeof postgres.anonCredsLinkSecret,
  typeof postgres,
  typeof sqlite.anonCredsLinkSecret,
  typeof sqlite
> {
  public customTagColumns = ['isDefault']

  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(
      database,
      { postgres: postgres.anonCredsLinkSecret, sqlite: sqlite.anonCredsLinkSecret },
      AnonCredsLinkSecretRecord
    )
  }
}
