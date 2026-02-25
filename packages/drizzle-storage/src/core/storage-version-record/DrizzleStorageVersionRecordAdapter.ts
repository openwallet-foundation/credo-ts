import { JsonTransformer, StorageVersionRecord, type TagsBase } from '@credo-ts/core'

import { BaseDrizzleRecordAdapter, type DrizzleAdapterRecordValues } from '../../adapter/BaseDrizzleRecordAdapter'

import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

type DrizzleStorageVersionRecordAdapterValues = DrizzleAdapterRecordValues<(typeof sqlite)['storageVersion']>
export class DrizzleStorageVersionRecordAdapter extends BaseDrizzleRecordAdapter<
  StorageVersionRecord,
  typeof postgres.storageVersion,
  typeof postgres,
  typeof sqlite.storageVersion,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.storageVersion, sqlite: sqlite.storageVersion }, StorageVersionRecord)
  }

  public getValues(record: StorageVersionRecord) {
    return {
      storageVersion: record.storageVersion,
      customTags: record.getTags() as Record<string, string>,
    }
  }

  public toRecord(values: DrizzleStorageVersionRecordAdapterValues): StorageVersionRecord {
    const { customTags, ...remainingValues } = values

    const record = JsonTransformer.fromJSON(remainingValues, StorageVersionRecord)
    record.setTags(customTags as TagsBase)

    return record
  }
}
