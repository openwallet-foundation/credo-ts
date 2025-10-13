import { AnonCredsRevocationRegistryDefinitionPrivateRecord } from '@credo-ts/anoncreds'
import { JsonTransformer, type TagsBase } from '@credo-ts/core'
import { BaseDrizzleRecordAdapter, type DrizzleAdapterRecordValues } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleAnonCredsRevocationRegistryDefinitionPrivateAdapterValues = DrizzleAdapterRecordValues<
  (typeof sqlite)['anonCredsRevocationRegistryDefinitionPrivate']
>
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

  public getValues(record: AnonCredsRevocationRegistryDefinitionPrivateRecord) {
    const { revocationRegistryDefinitionId, credentialDefinitionId, state, ...customTags } = record.getTags()

    return {
      revocationRegistryDefinitionId,
      credentialDefinitionId,
      state,
      value: record.value,
      customTags,
    }
  }

  public toRecord(
    values: DrizzleAnonCredsRevocationRegistryDefinitionPrivateAdapterValues
  ): AnonCredsRevocationRegistryDefinitionPrivateRecord {
    const { customTags, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, AnonCredsRevocationRegistryDefinitionPrivateRecord)
    if (customTags) record.setTags(customTags as TagsBase)

    return record
  }
}
