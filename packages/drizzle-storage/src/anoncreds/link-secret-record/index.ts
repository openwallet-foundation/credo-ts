import { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleAnonCredsLinkSecretRecordAdapter } from './DrizzleAnonCredsLinkSecretRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const anonCredsLinkSecretDrizzleRecord = {
  adapter: DrizzleAnonCredsLinkSecretRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord
