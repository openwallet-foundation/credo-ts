import type { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleTenantRecordAdapter } from './DrizzleTenantRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const tenantDrizzleRecord = {
  adapter: DrizzleTenantRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord
