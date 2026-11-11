import { W3cCredentialRecord } from '@credo-ts/core'

import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'

import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export class DrizzleW3cCredentialRecordAdapter extends BaseDrizzleRecordAdapter<
  W3cCredentialRecord,
  typeof postgres.w3cCredential,
  typeof postgres,
  typeof sqlite.w3cCredential,
  typeof sqlite
> {
  public customTagColumns = ['expandedTypes']

  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.w3cCredential, sqlite: sqlite.w3cCredential }, W3cCredentialRecord)
  }
}
