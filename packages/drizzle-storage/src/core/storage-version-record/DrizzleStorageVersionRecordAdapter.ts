import { StorageVersionRecord } from '@credo-ts/core'

import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'

import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

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
}
