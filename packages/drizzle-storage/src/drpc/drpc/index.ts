import { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleDidcommDrpcRecordAdapter } from './DrizzleDidcommDrpcRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const didcommDrpcDrizzleRecord = {
  adapter: DrizzleDidcommDrpcRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord
