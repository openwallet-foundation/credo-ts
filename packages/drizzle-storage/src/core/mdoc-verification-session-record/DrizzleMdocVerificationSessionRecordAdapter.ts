import { MdocVerificationSessionRecord } from '@credo-ts/core'

import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export class DrizzleMdocVerificationSessionRecordAdapter extends BaseDrizzleRecordAdapter<
  MdocVerificationSessionRecord,
  typeof postgres.mdocVerificationSession,
  typeof postgres,
  typeof sqlite.mdocVerificationSession,
  typeof sqlite
> {
  // Rows written before `session_key` was added only have `session_key_id`
  public legacyColumns = ['sessionKeyId']

  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(
      database,
      { postgres: postgres.mdocVerificationSession, sqlite: sqlite.mdocVerificationSession },
      MdocVerificationSessionRecord
    )
  }
}
