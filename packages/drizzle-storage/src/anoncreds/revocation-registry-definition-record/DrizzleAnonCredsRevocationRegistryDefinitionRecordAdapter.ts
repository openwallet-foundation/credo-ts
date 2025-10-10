import { JsonTransformer, type TagsBase } from '@credo-ts/core'

import { BaseDrizzleRecordAdapter, type DrizzleAdapterRecordValues } from '../../adapter/BaseDrizzleRecordAdapter'

import { AnonCredsRevocationRegistryDefinitionRecord } from '@credo-ts/anoncreds'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleAnonCredsRevocationRegistryDefinitionAdapterValues = DrizzleAdapterRecordValues<
  (typeof sqlite)['anonCredsRevocationRegistryDefinition']
>
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

  public getValues(record: AnonCredsRevocationRegistryDefinitionRecord) {
    const { revocationRegistryDefinitionId, credentialDefinitionId, ...customTags } = record.getTags()

    return {
      revocationRegistryDefinitionId,
      credentialDefinitionId,
      revocationRegistryDefinition: record.revocationRegistryDefinition,
      customTags,
    }
  }

  public toRecord(
    values: DrizzleAnonCredsRevocationRegistryDefinitionAdapterValues
  ): AnonCredsRevocationRegistryDefinitionRecord {
    const { customTags, credentialDefinitionId, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, AnonCredsRevocationRegistryDefinitionRecord)
    record.setTags({ ...customTags, credentialDefinitionId } as TagsBase)

    return record
  }
}
