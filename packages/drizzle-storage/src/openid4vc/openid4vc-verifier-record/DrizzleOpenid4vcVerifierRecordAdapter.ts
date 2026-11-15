import { OpenId4VcVerifierRecord } from '@credo-ts/openid4vc'
import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export class DrizzleOpenid4vcVerifierRecordAdapter extends BaseDrizzleRecordAdapter<
  OpenId4VcVerifierRecord,
  typeof postgres.openid4vcVerifier,
  typeof postgres,
  typeof sqlite.openid4vcVerifier,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.openid4vcVerifier, sqlite: sqlite.openid4vcVerifier }, OpenId4VcVerifierRecord)
  }
}
