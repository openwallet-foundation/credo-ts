import { TenantRecord } from '@credo-ts/tenants'
import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export class DrizzleTenantRecordAdapter extends BaseDrizzleRecordAdapter<
  TenantRecord,
  typeof postgres.tenant,
  typeof postgres,
  typeof sqlite.tenant,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.tenant, sqlite: sqlite.tenant }, TenantRecord)
  }
}
