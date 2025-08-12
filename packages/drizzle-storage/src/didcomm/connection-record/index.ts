import { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleDidcommConnectionRecordAdapter } from './DrizzleDidcommConnectionRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const didcommConnectionDrizzleRecord = {
  adapter: DrizzleDidcommConnectionRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord
