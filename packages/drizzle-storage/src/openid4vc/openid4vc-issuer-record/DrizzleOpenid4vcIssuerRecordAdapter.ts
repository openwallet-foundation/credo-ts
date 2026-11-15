import { OpenId4VcIssuerRecord } from '@credo-ts/openid4vc'
import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export class DrizzleOpenid4vcIssuerRecordAdapter extends BaseDrizzleRecordAdapter<
  OpenId4VcIssuerRecord,
  typeof postgres.openid4vcIssuer,
  typeof postgres,
  typeof sqlite.openid4vcIssuer,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.openid4vcIssuer, sqlite: sqlite.openid4vcIssuer }, OpenId4VcIssuerRecord)
  }
}
