import { AnonCredsCredentialDefinitionPrivateRecord } from '@credo-ts/anoncreds'
import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export class DrizzleAnonCredsCredentialDefinitionPrivateRecordAdapter extends BaseDrizzleRecordAdapter<
  AnonCredsCredentialDefinitionPrivateRecord,
  typeof postgres.anonCredsCredentialDefinitionPrivate,
  typeof postgres,
  typeof sqlite.anonCredsCredentialDefinitionPrivate,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(
      database,
      { postgres: postgres.anonCredsCredentialDefinitionPrivate, sqlite: sqlite.anonCredsCredentialDefinitionPrivate },
      AnonCredsCredentialDefinitionPrivateRecord
    )
  }
}
