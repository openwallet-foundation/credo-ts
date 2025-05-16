import { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleGenericRecordAdapter } from './DrizzleGenericRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const genericRecordDrizzleRecord = {
  adapter: DrizzleGenericRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord
