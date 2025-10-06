import { JsonTransformer, TagsBase } from '@credo-ts/core'

import { BaseDrizzleRecordAdapter, DrizzleAdapterRecordValues } from '../../adapter/BaseDrizzleRecordAdapter'

import { AnonCredsCredentialDefinitionPrivateRecord } from '@credo-ts/anoncreds'
import { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleAnonCredsCredentialDefinitionPrivateAdapterValues = DrizzleAdapterRecordValues<
  (typeof sqlite)['anonCredsCredentialDefinitionPrivate']
>
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

  public getValues(record: AnonCredsCredentialDefinitionPrivateRecord) {
    const { credentialDefinitionId, ...customTags } = record.getTags()

    return {
      credentialDefinitionId,
      value: record.value,
      customTags,
    }
  }

  public toRecord(
    values: DrizzleAnonCredsCredentialDefinitionPrivateAdapterValues
  ): AnonCredsCredentialDefinitionPrivateRecord {
    const { customTags, credentialDefinitionId, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, AnonCredsCredentialDefinitionPrivateRecord)
    record.setTags({ ...customTags, credentialDefinitionId } as TagsBase)

    return record
  }
}
