import type { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleAnonCredsCredentialRecordAdapter } from './DrizzleAnonCredsCredentialRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const anonCredsCredentialDrizzleRecord = {
  adapter: DrizzleAnonCredsCredentialRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord
