import type { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleOpenId4VcIssuanceSessionRecordAdapter } from './DrizzleOpenId4VcIssuanceSessionRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const openId4VcIssuanceSessionDrizzleRecord = {
  adapter: DrizzleOpenId4VcIssuanceSessionRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord
