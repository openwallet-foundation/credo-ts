import { AnonCredsRevocationRegistryDefinitionRecord } from '@credo-ts/anoncreds'
import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export class DrizzleAnonCredsRevocationRegistryDefinitionRecordAdapter extends BaseDrizzleRecordAdapter<
  AnonCredsRevocationRegistryDefinitionRecord,
  typeof postgres.anonCredsRevocationRegistryDefinition,
  typeof postgres,
  typeof sqlite.anonCredsRevocationRegistryDefinition,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(
      database,
      {
        postgres: postgres.anonCredsRevocationRegistryDefinition,
        sqlite: sqlite.anonCredsRevocationRegistryDefinition,
      },
      AnonCredsRevocationRegistryDefinitionRecord
    )
  }
}
