import type { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleW3cCredentialRecordAdapter } from './DrizzleW3cCredentialRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const w3cCredentialDrizzleRecord = {
  adapter: DrizzleW3cCredentialRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord
