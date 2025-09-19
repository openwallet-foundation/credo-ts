import type { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleSdJwtVcRecordAdapter } from './DrizzleSdJwtVcRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const sdJwtVcDrizzleRecord = {
  adapter: DrizzleSdJwtVcRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord
