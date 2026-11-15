import { GenericRecord } from '@credo-ts/core'

import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'

import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export class DrizzleGenericRecordAdapter extends BaseDrizzleRecordAdapter<
  GenericRecord,
  typeof postgres.genericRecord,
  typeof postgres,
  typeof sqlite.genericRecord,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.genericRecord, sqlite: sqlite.genericRecord }, GenericRecord)
  }
}
