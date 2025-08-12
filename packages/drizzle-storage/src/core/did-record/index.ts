import { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleDidRecordAdapter } from './DrizzleDidRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const didDrizzleRecord = {
  adapter: DrizzleDidRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord
