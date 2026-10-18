import { TenantRoutingRecord } from '@credo-ts/tenants'
import { BaseDrizzleRecordAdapter } from '../../adapter/BaseDrizzleRecordAdapter'
import type { DrizzleDatabase } from '../../DrizzleDatabase'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export class DrizzleTenantRoutingRecordAdapter extends BaseDrizzleRecordAdapter<
  TenantRoutingRecord,
  typeof postgres.tenantRouting,
  typeof postgres,
  typeof sqlite.tenantRouting,
  typeof sqlite
> {
  public constructor(database: DrizzleDatabase<typeof postgres, typeof sqlite>) {
    super(database, { postgres: postgres.tenantRouting, sqlite: sqlite.tenantRouting }, TenantRoutingRecord)
  }
}
