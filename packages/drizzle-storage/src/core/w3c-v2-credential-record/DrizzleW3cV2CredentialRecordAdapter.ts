import { W3cV2CredentialRecord } from '@credo-ts/core'

import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'

import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export class DrizzleW3cV2CredentialRecordAdapter extends BaseDrizzleRecordAdapter<
  W3cV2CredentialRecord,
  typeof postgres.w3cV2Credential,
  typeof postgres,
  typeof sqlite.w3cV2Credential,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.w3cV2Credential, sqlite: sqlite.w3cV2Credential }, W3cV2CredentialRecord)
  }
}
