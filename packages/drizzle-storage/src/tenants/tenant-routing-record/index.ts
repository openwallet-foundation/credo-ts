import type { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleTenantRoutingRecordAdapter } from './DrizzleTenantRoutingRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const tenantRoutingDrizzleRecord = {
  adapter: DrizzleTenantRoutingRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord
