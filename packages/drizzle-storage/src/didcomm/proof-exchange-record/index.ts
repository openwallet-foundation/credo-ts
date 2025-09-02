import { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleDidcommProofExchangeRecordAdapter } from './DrizzleDidcommProofExchangeRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const didcommProofExchangeDrizzleRecord = {
  adapter: DrizzleDidcommProofExchangeRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord
