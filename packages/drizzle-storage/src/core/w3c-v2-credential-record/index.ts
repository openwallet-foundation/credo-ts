import { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleW3cV2CredentialRecordAdapter } from './DrizzleW3cV2CredentialRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const w3cV2CredentialDrizzleRecord = {
  adapter: DrizzleW3cV2CredentialRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord
