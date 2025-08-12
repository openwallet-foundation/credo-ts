import { JsonTransformer, TagsBase } from '@credo-ts/core'

import { BaseDrizzleRecordAdapter, DrizzleAdapterRecordValues } from '../../adapter/BaseDrizzleRecordAdapter'

import { AnonCredsLinkSecretRecord } from '@credo-ts/anoncreds'
import { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleAnonCredsLinkSecretAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['anonCredsLinkSecret']>
export class DrizzleAnonCredsLinkSecretRecordAdapter extends BaseDrizzleRecordAdapter<
  AnonCredsLinkSecretRecord,
  typeof postgres.anonCredsLinkSecret,
  typeof postgres,
  typeof sqlite.anonCredsLinkSecret,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(
      database,
      { postgres: postgres.anonCredsLinkSecret, sqlite: sqlite.anonCredsLinkSecret },
      'AnonCredsLinkSecretRecord'
    )
  }

  public getValues(record: AnonCredsLinkSecretRecord) {
    const { linkSecretId, isDefault, ...customTags } = record.getTags()

    return {
      linkSecretId,
      isDefault,
      value: record.value,
      customTags,
    }
  }

  public toRecord(values: DrizzleAnonCredsLinkSecretAdapterValues): AnonCredsLinkSecretRecord {
    const { customTags, isDefault, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, AnonCredsLinkSecretRecord)
    record.setTags({ ...customTags, isDefault: isDefault ?? undefined } as TagsBase)

    return record
  }
}
