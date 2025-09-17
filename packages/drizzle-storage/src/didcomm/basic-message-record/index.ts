import { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleDidcommBasicMessageRecordAdapter } from './DrizzleDidcommBasicMessageRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const didcommBasicMessageDrizzleRecord = {
  adapter: DrizzleDidcommBasicMessageRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord
