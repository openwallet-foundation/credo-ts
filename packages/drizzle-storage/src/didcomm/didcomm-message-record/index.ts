import type { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleDidcommMessageRecordAdapter } from './DrizzleDidcommMessageRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const didcommMessageDrizzleRecord = {
  adapter: DrizzleDidcommMessageRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord
