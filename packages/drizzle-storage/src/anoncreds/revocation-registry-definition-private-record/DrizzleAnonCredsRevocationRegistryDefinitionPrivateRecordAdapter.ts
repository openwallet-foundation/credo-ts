import { AnonCredsRevocationRegistryDefinitionPrivateRecord } from '@credo-ts/anoncreds'
import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export class DrizzleAnonCredsRevocationRegistryDefinitionPrivateRecordAdapter extends BaseDrizzleRecordAdapter<
  AnonCredsRevocationRegistryDefinitionPrivateRecord,
  typeof postgres.anonCredsRevocationRegistryDefinitionPrivate,
  typeof postgres,
  typeof sqlite.anonCredsRevocationRegistryDefinitionPrivate,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(
      database,
      {
        postgres: postgres.anonCredsRevocationRegistryDefinitionPrivate,
        sqlite: sqlite.anonCredsRevocationRegistryDefinitionPrivate,
      },
      AnonCredsRevocationRegistryDefinitionPrivateRecord
    )
  }
}
