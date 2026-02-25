import type { DrizzleRecord } from '../../DrizzleRecord'
import { DrizzleOpenid4vcVerifierRecordAdapter } from './DrizzleOpenid4vcVerifierRecordAdapter'
import * as postgres from './postgres'
import * as sqlite from './sqlite'

export const openid4vcVerifierDrizzleRecord = {
  adapter: DrizzleOpenid4vcVerifierRecordAdapter,
  postgres,
  sqlite,
} satisfies DrizzleRecord
