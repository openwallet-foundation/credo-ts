import { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleDidcommCredentialExchangeRecordAdapter } from './DrizzleDidcommCredentialExchangeRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const didcommCredentialExchangeDrizzleRecord = {
  adapter: DrizzleDidcommCredentialExchangeRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord
