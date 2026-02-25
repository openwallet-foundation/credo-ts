import type { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleDidcommActionMenuRecordAdapter } from './DrizzleDidcommActionMenuRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const didcommActionMenuDrizzleRecord = {
  adapter: DrizzleDidcommActionMenuRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord
