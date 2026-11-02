import { OpenId4VcVerificationSessionRecord } from '@credo-ts/openid4vc'
import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export class DrizzleOpenId4VcVerificationSessionRecordAdapter extends BaseDrizzleRecordAdapter<
  OpenId4VcVerificationSessionRecord,
  typeof postgres.openId4VcVerificationSession,
  typeof postgres,
  typeof sqlite.openId4VcVerificationSession,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(
      database,
      { postgres: postgres.openId4VcVerificationSession, sqlite: sqlite.openId4VcVerificationSession },
      OpenId4VcVerificationSessionRecord
    )
  }
}
