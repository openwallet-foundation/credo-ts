import { DidRecord } from '@credo-ts/core'

import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'

import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export class DrizzleDidRecordAdapter extends BaseDrizzleRecordAdapter<
  DidRecord,
  typeof postgres.did,
  typeof postgres,
  typeof sqlite.did,
  typeof sqlite
> {
  public customTagColumns = ['recipientKeyFingerprints', 'alternativeDids']

  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.did, sqlite: sqlite.did }, DidRecord)
  }
}
