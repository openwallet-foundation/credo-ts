import { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleDidcommOutOfBandRecordAdapter } from './DrizzleDidcommOutOfBandRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const didcommOutOfBandDrizzleRecord = {
  adapter: DrizzleDidcommOutOfBandRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord
