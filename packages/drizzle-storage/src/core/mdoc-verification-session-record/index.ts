import type { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleMdocVerificationSessionRecordAdapter } from './DrizzleMdocVerificationSessionRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const mdocVerificationSessionDrizzleRecord = {
  adapter: DrizzleMdocVerificationSessionRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord
