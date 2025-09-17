import { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleDidcommMediatorRoutingRecordAdapter } from './DrizzleDidcommMediatorRoutingRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const didcommMediatorRoutingDrizzleRecord = {
  adapter: DrizzleDidcommMediatorRoutingRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord
