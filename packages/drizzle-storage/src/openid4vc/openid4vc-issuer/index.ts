import { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleOpenid4vcIssuerRecordAdapter } from './DrizzleOpenid4vcIssuerRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const openid4vcIssuerDrizzleRecord = {
  adapter: DrizzleOpenid4vcIssuerRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord
