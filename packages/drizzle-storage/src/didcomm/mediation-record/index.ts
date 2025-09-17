import { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleDidcommMediationRecordAdapter } from './DrizzleDidcommMediationRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const didcommMediationDrizzleRecord = {
  adapter: DrizzleDidcommMediationRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord
